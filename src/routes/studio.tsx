import { createFileRoute } from "@tanstack/react-router";
import { StudioApp } from "../components/studio/studio-app";

export const Route = createFileRoute("/studio")({ component: Studio });

function Studio() {
  return <StudioApp />;
}
