import { useEffect, useState } from "react";
import "./App.css";
import Home from "./Home";
import Host from "./Host";
import Participant from "./Participant";

function usePath(): string {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const update = () => setPath(window.location.pathname);
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  return path;
}

export default function App() {
  const path = usePath();
  if (path === "/host") return <Host />;
  const joinMatch = path.match(/^\/join\/(\d{6})$/);
  if (joinMatch) return <Participant initialCode={joinMatch[1]} />;
  return <Home />;
}
