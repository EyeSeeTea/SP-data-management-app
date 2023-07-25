import i18n from "../locales";
import _ from "lodash";
import Project, { DataElementInfo, SectorsInfo } from "./Project";
import { Maybe } from "../types/utils";

export type ProjectInfoNode =
    | {
          type: "field";
          name: string;
          value: string;
          prevValue: Maybe<string>;
      }
    | {
          type: "value";
          value: string;
          action: Action;
          prevValue: Maybe<string>;
      }
    | {
          type: "section";
          title: string;
          action: Action;
          children: ProjectInfoNode[];
      };

export type Action = "none" | "updated" | "added" | "removed";

export class ProjectInfo {
    constructor(private project: Project) {}

    getAsString(): string {
        return this.nodesAsString(this.getNodes()).join("\n");
    }

    getNodes(): ProjectInfoNode[] {
        const { project } = this;
        const prevProject = project.getInitialProject();
        const fields = Project.fieldNames;

        function field(name: string, getValue: (project: Project) => string): ProjectInfoNode {
            return {
                type: "field",
                name: name,
                value: getValue(project),
                prevValue: prevProject ? getValue(prevProject) : undefined,
            };
        }

        return [
            field(fields.name, project => project.name),
            field(fields.description, project => project.description),
            field(fields.awardNumber, project => project.awardNumber),
            field(fields.subsequentLettering, project => project.subsequentLettering),
            field(fields.additional, project => project.additional),
            field(i18n.t("Period dates"), project => project.getPeriodInterval()),
            field(fields.funders, project => displayNames(project.funders)),
            field(i18n.t("Selected country"), project =>
                project.parentOrgUnit ? project.parentOrgUnit.displayName : "-"
            ),
            field(i18n.t("Locations"), project =>
                project.locations.map(location => location.displayName).join(", ")
            ),
            section(i18n.t("Sharing"), [
                field(i18n.t("Users"), project => names(project.sharing.userAccesses)),
                field(i18n.t("User Groups"), project => names(project.sharing.userGroupAccesses)),
            ]),
            section("Sectors", this.getSectorsInfoNodes()),
        ];
    }

    /* Private interface */

    private getSectorsInfoNodes(): ProjectInfoNode[] {
        const { project } = this;
        const prevProject = project.getInitialProject();
        const isNewProject = !project.initialData;
        const sectorsInfo = this.project.getSectorsInfo();
        const prevSectorsInfo = prevProject?.getSectorsInfo() || [];

        const updated = _.intersectionBy(sectorsInfo, prevSectorsInfo, o => o.sector.id);
        const added = _.differenceBy(sectorsInfo, prevSectorsInfo, o => o.sector.id);
        const removed = _.differenceBy(prevSectorsInfo, sectorsInfo, o => o.sector.id);

        const infoByAction: Array<[SectorsInfo, Action]> = [
            [updated, "none"],
            [added, "added"],
            [removed, "removed"],
        ];

        return _(infoByAction)
            .flatMap(([sectorsInfo, action]) => {
                return sectorsInfo.map(obj => {
                    const { sector, dataElementsInfo } = obj;

                    const prevDataElementsInfo =
                        prevSectorsInfo.find(info => info.sector.id === sector.id)
                            ?.dataElementsInfo || [];

                    const kept = _.intersectionBy(
                        dataElementsInfo,
                        prevDataElementsInfo,
                        o => o.dataElement.id
                    );
                    const added = _.differenceBy(
                        dataElementsInfo,
                        prevDataElementsInfo,
                        o => o.dataElement.id
                    );
                    const removed = _.differenceBy(
                        prevDataElementsInfo,
                        dataElementsInfo,
                        o => o.dataElement.id
                    );

                    const infoByAction: Array<[DataElementInfo[], Action]> = [
                        [kept, "none"],
                        [added, "added"],
                        [removed, "removed"],
                    ];

                    const children = _(infoByAction)
                        .flatMap(([dataElementsInfo, action]) => {
                            return dataElementsInfo.map((info): ProjectInfoNode => {
                                const action2 = isNewProject ? "none" : action;
                                const prevDataElementInfo = prevDataElementsInfo.find(
                                    prevInfo => prevInfo.dataElement.id === info.dataElement.id
                                );

                                return {
                                    type: "value",
                                    value: getDataElementInfoAsString(info),
                                    prevValue: prevDataElementInfo
                                        ? getDataElementInfoAsString(prevDataElementInfo)
                                        : undefined,
                                    action: action2,
                                };
                            });
                        })
                        .value();

                    const action2 = isNewProject ? "none" : action;
                    return section(sector.displayName, children, { action: action2 });
                });
            })
            .value();
    }

    private nodesAsString(nodes: ProjectInfoNode[]): string[] {
        const applyIndent = (lines: string[]) => lines.map(line => _.repeat(" ", 2) + line);

        return _(nodes)
            .flatMap((node): string[] => {
                switch (node.type) {
                    case "field":
                        return [render(node)];
                    case "value":
                        return [render({ name: undefined, ...node })];
                    case "section":
                        return [
                            ["- ", action(node), node.title, ":"].join(""),
                            ...applyIndent(this.nodesAsString(node.children)),
                        ];
                }
            })
            .value();
    }
}

function section(
    title: string,
    children: ProjectInfoNode[],
    options: { action: Action } = { action: "none" }
): ProjectInfoNode {
    return { type: "section", title: title, action: options.action, children: children };
}

function names(objects: { name: string }[]): string {
    return objects.map(obj => obj.name).join(", ") || "-";
}

function displayNames(objects: { displayName: string }[]): string {
    return objects.map(obj => obj.displayName).join(", ") || "-";
}

function action(withAction: { action?: Action }) {
    return !withAction.action || withAction.action === "none"
        ? ""
        : `[${actionNames[withAction.action]}] `;
}

function render(options: {
    name: Maybe<string>;
    value: string;
    prevValue: Maybe<string>;
    action?: Action;
}) {
    const { name, value, prevValue } = options;

    return [
        "- ",
        action(options),
        name ? `${name}: ` : "",
        prevValue !== undefined && prevValue !== value ? `${prevValue} -> ` : "",
        value,
    ].join("");
}

export const actionNames: Record<Action, string> = {
    none: i18n.t("NONE"),
    updated: i18n.t("UPDATED"),
    added: i18n.t("ADDED"),
    removed: i18n.t("REMOVED"),
};

function getDataElementInfoAsString(info: DataElementInfo) {
    const { dataElement, isMER, isCovid19 } = info;
    const hiddenMsg = i18n.t("Hidden in data entry as it is selected in multiple sectors!");

    return [
        `${dataElement.name} - ${dataElement.code}`,
        isCovid19 ? ` [${i18n.t("COVID-19")}]` : "",
        isMER ? ` [${i18n.t("MER")}]` : "",
        info.usedInDataSetSection ? "" : ` - ${hiddenMsg}`,
    ].join("");
}
