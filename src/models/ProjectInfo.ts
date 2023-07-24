import i18n from "../locales";
import _ from "lodash";
import Project from "./Project";

export type ProjectInfoNode =
    | { type: "field"; name: string; value: string }
    | { type: "section"; name: string; children: ProjectInfoNode[] };

export class ProjectInfo {
    constructor(private project: Project) {}

    getAsString(): string {
        return this.nodesAsString(this.getNodes(), { indent: 0 });
    }

    private nodesAsString(nodes: ProjectInfoNode[], options: { indent: number }): string {
        const applyIndent = (s: string) => _.repeat(" ", options.indent) + s;
        const withLabel = (label: string, value?: string) =>
            `- ` + (label ? `${label}: ` : "") + (value || "");

        return _(nodes)
            .flatMap(node => {
                switch (node.type) {
                    case "field":
                        return [applyIndent(withLabel(node.name, node.value))];
                    case "section":
                        return [
                            applyIndent(withLabel(node.name)),
                            this.nodesAsString(node.children, { indent: options.indent + 1 }),
                        ];
                }
            })
            .join("\n");
    }

    getNodes(): ProjectInfoNode[] {
        const { project } = this;
        const fields = Project.fieldNames;

        return [
            field(fields.name, project.name),
            field(fields.description, project.description),
            field(fields.awardNumber, project.awardNumber),
            field(fields.subsequentLettering, project.subsequentLettering),
            field(fields.additional, project.additional),
            field(i18n.t("Period dates"), project.getPeriodInterval()),
            field(fields.funders, getNames(project.funders)),
            field(
                i18n.t("Selected country"),
                project.parentOrgUnit ? project.parentOrgUnit.displayName : "-"
            ),
            field(
                i18n.t("Locations"),
                project.locations.map(location => location.displayName).join(", ")
            ),
            section(i18n.t("Sharing"), [
                field(
                    i18n.t("Users"),
                    project.sharing.userAccesses.map(ua => ua.name).join(", ") || "-"
                ),
                field(
                    i18n.t("User groups"),
                    project.sharing.userGroupAccesses.map(uga => uga.name).join(", ") || "-"
                ),
            ]),
            section("Sectors", this.getSectorsInfo()),
        ];
    }

    private getSectorsInfo(): ProjectInfoNode[] {
        const sectorsInfo = this.project.getSectorsInfo();
        const hiddenMsg = i18n.t("Hidden in data entry as it is selected in multiple sectors!");

        return sectorsInfo.map(({ sector, dataElementsInfo }) => {
            const value = dataElementsInfo.map(
                ({ dataElement, isMER, isCovid19, usedInDataSetSection }) => {
                    const parts = [
                        `${dataElement.name} - ${dataElement.code}`,
                        isCovid19 ? ` [${i18n.t("COVID-19")}]` : "",
                        isMER ? ` [${i18n.t("MER")}]` : "",
                        usedInDataSetSection ? "" : ` - ${hiddenMsg}`,
                    ];
                    return field("", parts.join(""));
                }
            );
            return section(sector.displayName, value);
        });
    }
}

function field(name: string, value: string): ProjectInfoNode {
    return { type: "field", name: name, value: value };
}

function section(title: string, children: ProjectInfoNode[]): ProjectInfoNode {
    return { type: "section", name: title, children: children };
}

function getNames(objects: { displayName: string }[]) {
    return objects.map(obj => obj.displayName).join(", ");
}
