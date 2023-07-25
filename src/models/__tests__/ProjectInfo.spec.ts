import { getMockApi } from "../../types/d2-api";
import { getProject } from "./project-data";

const { api } = getMockApi();

test("getNodes", () => {
    const project = getProjectWithChanges();
    const nodes = project.info.getNodes();
    expect(nodes).toMatchSnapshot();
});

test("getAsString", () => {
    const project = getProjectWithChanges();
    const infoString = project.info.getAsString();
    expect(infoString).toMatchSnapshot();
});

test("getAsString on new project", () => {
    const project = getProject(api, {}).set("initialData", undefined);
    const infoString = project.info.getAsString();
    expect(infoString).toMatchSnapshot();
});

function getProjectWithChanges() {
    const baseProject0 = getProject(api, {});
    const baseProject = baseProject0.set("initialData", baseProject0.data);
    const newSectors = baseProject.config.sectors.filter(s => s.code === "SECTOR_EDUCATION");
    const keepSector = baseProject.sectors[0];

    const project = baseProject
        .set("name", "Old name")
        .setSectors([keepSector].concat(newSectors))
        .setCovid19({
            dataElementsSet: baseProject.dataElementsSelection,
            sectorId: keepSector.id,
            dataElementIds: ["ik0ICagvIjm"],
            isSet: true,
        }).project;

    return project;
}
