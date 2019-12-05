import Project from "./Project";
import moment from "moment";

export function getDevProject(initialProject: Project, enabled: boolean) {
    if (!enabled) return initialProject;

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
        .set("name", "Test1")
        .set("awardNumber", "12345")
        .set("subsequentLettering", "en")
        .set("startDate", moment().subtract(1, "month"))
        .set("funders", [
            { id: "OKEZCrPzqph", displayName: "Atlas Copco" },
            { id: "em8NIwi0KvM", displayName: "Agridius Foundation" },
        ])
        .set("endDate", moment().add(1, "month"));
}
