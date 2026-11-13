import { useParams } from "react-router";
import { ProjectId } from "@overview/domain";
import { RouteParams } from "../../../app/Routes.js";
import { ErrorState } from "../../../components/shared/ErrorState/ErrorState.js";
import { HomePage } from "../../home/HomePage/HomePage.js";

// One project's page: the library with its main column given over to the project.
export function ProjectRoute() {
  const parsed = ProjectId.safeParse(useParams()[RouteParams.projectId]);
  if (!parsed.success) return <ErrorState screen="notFound" title="There's nothing at this address" back />;
  return <HomePage key={parsed.data} place={{ kind: "project", projectId: parsed.data }} />;
}
