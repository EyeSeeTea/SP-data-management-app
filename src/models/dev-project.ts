import Project from "./Project";
import moment from "moment";

function getRandomInt(min: number, max: number): number {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function getDevProject(initialProject: Project, enabled: boolean) {
    if (!enabled) return initialProject;
    const awardNumber = getRandomInt(10000, 99999).toString();

    return initialProject
        .set("organisationUnit", { path: "/J0hschZVMBt/PJb0RtEnqlf" })
        .set("sectors", [
            { id: "mGQ5ckOTU8A", displayName: "Agriculture" },
            { id: "m4Cg6FOPPR7", displayName: "Livelihoods" },
        ])
        .set(
            "dataElements",
            initialProject.dataElements
                .updateSelection(["WS8XV4WWPE7", "ik0ICagvIjm", "We61YNYyOX0"])
                .dataElements.updateMERSelection(["WS8XV4WWPE7", "We61YNYyOX0"])
        )
        .set("name", "Test1-" + awardNumber)
        .set("awardNumber", awardNumber)
        .set("subsequentLettering", "en")
        .set("startDate", moment().startOf("month"))
        .set(
            "endDate",
            moment()
                .add(3, "month")
                .endOf("month")
        )
        .set("funders", [
            { id: "OKEZCrPzqph", displayName: "Atlas Copco" },
            { id: "em8NIwi0KvM", displayName: "Agridius Foundation" },
        ]);
}
