import { Radio } from "lucide-react";
import { go } from "./navigation";

export function Brand() {
  return (
    <button className="brand" onClick={() => go("/")}>
      <Radio size={25} /> Pulse
    </button>
  );
}
