import Project from "./Project";
import moment from "moment";

export function getDevProject(initialProject: Project, enabled: boolean) {
    if (!enabled) return initialProject;
    const n = (Math.floor(Math.random() * (99999 - 10000 + 1)) + 10000).toString();

    return initialProject
        .set("organisationUnit", { path: "/J0hschZVMBt/PJb0RtEnqlf" })
        .set("sectors", [
            { id: "mGQ5ckOTU8A", displayName: "Agriculture" },
            { id: "m4Cg6FOPPR7", displayName: "Livelihoods" },
        ])
        .set(
            "dataElements",
            initialProject.dataElements.updateSelection([
                "WS8XV4WWPE7",
                "ik0ICagvIjm",
                "We61YNYyOX0",
            ]).dataElements
        )
        .set("name", "0Test-" + n)
        .set("awardNumber", n)
        .set("subsequentLettering", "en")
        .set("startDate", moment().set("date", 10))
        .set(
            "endDate",
            moment()
                .add(3, "month")
                .set("date", 20)
        )
        .set("funders", [
            { id: "OKEZCrPzqph", displayName: "Atlas Copco" },
            { id: "em8NIwi0KvM", displayName: "Agridius Foundation" },
        ]);
}
