#Requires -Version 7.0
<#
.SYNOPSIS
  Deploys Pulse to Azure Container Apps (build via ACR, single replica, optional persistent /app/data volume).

.DESCRIPTION
  - Creates (if needed) a resource group, an Azure Container Registry, a Container Apps environment,
    and a Container App running the Docker image defined by the repo's Dockerfile.
  - Builds the image directly in Azure (az acr build), so Docker does not need to run locally.
  - Forces a single replica (min=max=1) because the app keeps in-memory/session state and is not
    designed to run with multiple instances (see README).
  - Optionally mounts an Azure Files share on /app/data so the quiz session survives restarts.

.PARAMETER SubscriptionId
  The Azure subscription to deploy into. Required, since this is not your default subscription.

.PARAMETER ResourceGroup
  Name of the resource group to create/use.

.PARAMETER Location
  Azure region (e.g. francecentral, westeurope).

.PARAMETER AppName
  Name of the Container App (also used to derive other resource names).

.PARAMETER WithPersistence
  If set, provisions a storage account + file share and mounts it on /app/data.

.EXAMPLE
  ./deploy-azure.ps1 -SubscriptionId "00000000-0000-0000-0000-000000000000" -ResourceGroup "rg-pulse-demo" -Location "francecentral" -AppName "pulse-quiz"

.EXAMPLE
  ./deploy-azure.ps1 -SubscriptionId "00000000-0000-0000-0000-000000000000" -ResourceGroup "rg-pulse-demo" -Location "francecentral" -AppName "pulse-quiz" -WithPersistence
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$SubscriptionId,

    [Parameter(Mandatory = $true)]
    [string]$ResourceGroup,

    [string]$Location = "francecentral",

    [string]$AppName = "pulse-quiz",

    [switch]$WithPersistence
)

$ErrorActionPreference = "Stop"

function Assert-AzCli {
    if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
        throw "Azure CLI ('az') introuvable. Installez-le : https://learn.microsoft.com/cli/azure/install-azure-cli"
    }
}

Assert-AzCli

# Derived, DNS-safe resource names (must be lowercase, alphanumeric).
$suffix = ($AppName -replace '[^a-z0-9]', '').ToLower()
$acrName = "acr$suffix"                 # Container registry name must be globally unique, alphanumeric only
$envName = "$AppName-env"
$storageAccountName = "st$suffix"        # Storage account name must be globally unique, <=24 chars, lowercase alphanumeric
$fileShareName = "pulse-data"
$imageName = "pulse"
$imageTag = "latest"

Write-Host "==> Sélection de l'abonnement $SubscriptionId" -ForegroundColor Cyan
az account set --subscription $SubscriptionId

Write-Host "==> Enregistrement des fournisseurs de ressources nécessaires" -ForegroundColor Cyan
az provider register --namespace Microsoft.App --wait
az provider register --namespace Microsoft.OperationalInsights --wait
az provider register --namespace Microsoft.ContainerRegistry --wait
if ($WithPersistence) {
    az provider register --namespace Microsoft.Storage --wait
}

Write-Host "==> Création du groupe de ressources $ResourceGroup ($Location)" -ForegroundColor Cyan
az group create --name $ResourceGroup --location $Location --output none

Write-Host "==> Création du registre de conteneurs $acrName" -ForegroundColor Cyan
az acr create `
    --resource-group $ResourceGroup `
    --name $acrName `
    --sku Basic `
    --admin-enabled true `
    --output none

Write-Host "==> Build de l'image Docker dans Azure (az acr build)" -ForegroundColor Cyan
az acr build `
    --registry $acrName `
    --image "${imageName}:${imageTag}" `
    --file Dockerfile `
    .

$acrLoginServer = az acr show --name $acrName --query loginServer --output tsv
$acrUsername = az acr credential show --name $acrName --query username --output tsv
$acrPassword = az acr credential show --name $acrName --query "passwords[0].value" --output tsv

Write-Host "==> Installation/mise à jour de l'extension containerapp" -ForegroundColor Cyan
az extension add --name containerapp --upgrade --only-show-errors

Write-Host "==> Création de l'environnement Container Apps $envName" -ForegroundColor Cyan
az containerapp env create `
    --name $envName `
    --resource-group $ResourceGroup `
    --location $Location `
    --output none

if ($WithPersistence) {
    Write-Host "==> Création du compte de stockage $storageAccountName et du partage de fichiers $fileShareName" -ForegroundColor Cyan
    az storage account create `
        --name $storageAccountName `
        --resource-group $ResourceGroup `
        --location $Location `
        --sku Standard_LRS `
        --kind StorageV2 `
        --output none

    $storageKey = az storage account keys list `
        --account-name $storageAccountName `
        --resource-group $ResourceGroup `
        --query "[0].value" --output tsv

    az storage share-rm create `
        --storage-account $storageAccountName `
        --name $fileShareName `
        --quota 1 `
        --output none

    Write-Host "==> Association du partage de fichiers à l'environnement Container Apps" -ForegroundColor Cyan
    az containerapp env storage set `
        --name $envName `
        --resource-group $ResourceGroup `
        --storage-name $fileShareName `
        --azure-file-account-name $storageAccountName `
        --azure-file-account-key $storageKey `
        --azure-file-share-name $fileShareName `
        --access-mode ReadWrite `
        --output none
}

Write-Host "==> Déploiement du Container App $AppName" -ForegroundColor Cyan

$commonArgs = @(
    "--name", $AppName,
    "--resource-group", $ResourceGroup,
    "--environment", $envName,
    "--image", "$acrLoginServer/${imageName}:${imageTag}",
    "--registry-server", $acrLoginServer,
    "--registry-username", $acrUsername,
    "--registry-password", $acrPassword,
    "--target-port", "3000",
    "--ingress", "external",
    "--min-replicas", "1",
    "--max-replicas", "1",
    "--cpu", "0.5",
    "--memory", "1.0Gi",
    "--env-vars", "NODE_ENV=production"
)

az containerapp create @commonArgs --output none

if ($WithPersistence) {
    Write-Host "==> Montage du volume persistant sur /app/data" -ForegroundColor Cyan
    # containerapp create does not accept volume mounts directly; patch the revision via YAML.
    $revisionYaml = @"
properties:
  template:
    volumes:
      - name: pulse-data-volume
        storageType: AzureFile
        storageName: $fileShareName
    containers:
      - name: $AppName
        image: $acrLoginServer/${imageName}:${imageTag}
        volumeMounts:
          - volumeName: pulse-data-volume
            mountPath: /app/data
"@
    $tempFile = New-TemporaryFile
    Set-Content -Path $tempFile -Value $revisionYaml
    az containerapp update `
        --name $AppName `
        --resource-group $ResourceGroup `
        --yaml $tempFile `
        --output none
    Remove-Item $tempFile
}

$fqdn = az containerapp show --name $AppName --resource-group $ResourceGroup --query "properties.configuration.ingress.fqdn" --output tsv

Write-Host ""
Write-Host "==> Déploiement terminé" -ForegroundColor Green
Write-Host "URL de l'application : https://$fqdn"
Write-Host "Vérification santé   : https://$fqdn/api/health"
Write-Host ""
Write-Host "Pour redéployer après un changement de code, relancez simplement ce script :" -ForegroundColor Yellow
Write-Host "  ./deploy-azure.ps1 -SubscriptionId $SubscriptionId -ResourceGroup $ResourceGroup -Location $Location -AppName $AppName $(if ($WithPersistence) { '-WithPersistence' })"
