import _ from "lodash";
import i18n from "../locales";
import Project, { DataElementInfo, SectorsInfo } from "./Project";
import { Maybe } from "../types/utils";
import { Sector } from "./Config";
import { ProjectDocument } from "./ProjectDocument";

export class ProjectInfo {
    private actionNames: Record<Action, string>;

    constructor(private project: Project) {
        this.actionNames = ProjectInfo.getActionNames();
    }

    static getActionNames(): Record<Action, string> {
        return {
            none: i18n.t("NONE"),
            updated: i18n.t("UPDATED"),
            added: i18n.t("ADDED"),
            removed: i18n.t("REMOVED"),
        };
    }

    getAsString(): string {
        return this.nodesToString(this.getNodes()).join("\n");
    }

    getNodes(): ProjectInfoNode[] {
        const { project } = this;
        const prevProject = project.getInitialProject();
        const fields = Project.fieldNames;

        function field(name: string, getValue: (project: Project) => string): ProjectInfoNode {
            const value = getValue(project);
            const prevValue = prevProject ? getValue(prevProject) : undefined;
            const isUpdated = prevValue !== undefined && prevValue !== value;
            const action2 = isUpdated ? "updated" : "none";

            return { type: "field", name: name, value, prevValue, action: action2 };
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
            section("Sectors", this.getSectorsNodes()),
            section("Attached Files", this.getDocumentsNodes(prevProject)),
        ];
    }

    /* Private interface */

    private getDocumentsNodes(prevProject: Maybe<Project>): ProjectInfoNode[] {
        const { project } = this;
        const prevDocuments = prevProject ? prevProject.documents : [];

        const updatedAndDeletedActions = prevDocuments.map((prevDocument): ProjectInfoNode => {
            const newDocument = project.documents.find(doc => doc.id === prevDocument.id);
            const prevValue = newDocument ? newDocument.name : undefined;
            const isUpdated = prevValue !== undefined && prevValue !== prevDocument.name;
            const action = this.getDocumentAction(newDocument, isUpdated);

            return {
                action,
                type: "field",
                name: "File",
                prevValue,
                value: prevDocument.name,
            };
        });

        const newDocuments = project.documents.filter(document => !document.url);

        const newActions = newDocuments.map((document): ProjectInfoNode => {
            return {
                action: "added",
                type: "field",
                name: "File",
                prevValue: undefined,
                value: document.name,
            };
        });

        return newActions.concat(updatedAndDeletedActions);
    }

    private getDocumentAction(newDocument: Maybe<ProjectDocument>, isUpdated: boolean): Action {
        if (!newDocument) {
            return "removed";
        } else if (newDocument.url && isUpdated) {
            return "updated";
        } else {
            return "none";
        }
    }

    private getSectorsNodes(): ProjectInfoNode[] {
        const { project } = this;
        const prevProject = project.getInitialProject();
        const sectorsInfo = this.project.getSectorsInfo();
        const prevSectorsInfo = prevProject?.getSectorsInfo() || [];
        const infoByAction = getChanges(sectorsInfo, prevSectorsInfo, o => o.sector.id);

        return _(infoByAction)
            .flatMap(([sectorsInfo, action]) => {
                return sectorsInfo.map(({ sector, dataElementsInfo }) => {
                    return this.getSectorNode(sector, dataElementsInfo, prevSectorsInfo, action);
                });
            })
            .value();
    }

    private getSectorNode(
        sector: Sector,
        dataElementsInfo: DataElementInfo[],
        prevSectorsInfo: SectorsInfo,
        action: Action
    ): ProjectInfoNode {
        const isNewProject = !this.project.initialData;
        const action2 = isNewProject ? "none" : action;
        const prevDataElementsInfo =
            prevSectorsInfo.find(info => info.sector.id === sector.id)?.dataElementsInfo || [];
        const byAction = getChanges(dataElementsInfo, prevDataElementsInfo, i => i.dataElement.id);

        const children = _(byAction)
            .flatMap(([dataElementsInfo, action]) => {
                return dataElementsInfo.map((info): ProjectInfoNode => {
                    const prevDataElementInfo = prevDataElementsInfo.find(
                        prevInfo => prevInfo.dataElement.id === info.dataElement.id
                    );
                    const value = this.getDataElementInfoAsString(info);
                    const prevValue = prevDataElementInfo
                        ? this.getDataElementInfoAsString(prevDataElementInfo)
                        : undefined;
                    const isUpdated = prevValue !== undefined && value !== prevValue;
                    const action2 = isNewProject ? "none" : isUpdated ? "updated" : action;

                    return { type: "value", value: value, prevValue: prevValue, action: action2 };
                });
            })
            .value();

        return section(sector.displayName, children, { action: action2 });
    }

    private nodesToString(nodes: ProjectInfoNode[]): string[] {
        const applyIndent = (lines: string[]) => lines.map(line => _.repeat(" ", 2) + line);

        return _(nodes)
            .flatMap((node): string[] => {
                switch (node.type) {
                    case "field":
                        return [this.render(node)];
                    case "value":
                        return [this.render({ name: undefined, ...node })];
                    case "section":
                        return [
                            ["- ", this.action(node), node.title, ":"].join(""),
                            ...applyIndent(this.nodesToString(node.children)),
                        ];
                    default:
                        return [];
                }
            })
            .value();
    }

    private action(withAction: { action: Action }) {
        const { action } = withAction;
        return action === "none" ? "" : `[${this.actionNames[action]}] `;
    }

    private render(options: {
        name: Maybe<string>;
        value: string;
        prevValue: Maybe<string>;
        action: Action;
    }) {
        const { name, value, prevValue } = options;
        const isUpdated = prevValue !== undefined && prevValue !== value;
        const actionStr = this.action(options);

        return [
            "- ",
            _.compact([name ? `${name}: ` : null, actionStr]).join(""),
            isUpdated ? `${prevValue || "-"} -> ` : "",
            value || "-",
        ].join("");
    }

    private getDataElementInfoAsString(info: DataElementInfo) {
        const { dataElement, isMER, isCovid19 } = info;
        const hiddenMsg = i18n.t("Hidden in data entry as it is selected in multiple sectors!");

        return [
            `${dataElement.name} - ${dataElement.code}`,
            isCovid19 ? ` [${i18n.t("COVID-19")}]` : "",
            isMER ? ` [${i18n.t("MER")}]` : "",
            info.usedInDataSetSection ? "" : ` - ${hiddenMsg}`,
        ].join("");
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

function getChanges<T>(current: T[], prev: T[], getId: (obj: T) => string): Array<[T[], Action]> {
    const changes = {
        kept: _.intersectionBy(current, prev, getId),
        added: _.differenceBy(current, prev, getId),
        removed: _.differenceBy(prev, current, getId),
    };

    return [
        [changes.kept, "none"],
        [changes.added, "added"],
        [changes.removed, "removed"],
    ];
}

type FieldNode = {
    type: "field";
    name: string;
    value: string;
    action: Action;
    prevValue: Maybe<string>;
};

type NewType = {
    type: "value";
    value: string;
    action: Action;
    prevValue: Maybe<string>;
};

type SectionNode = {
    type: "section";
    title: string;
    action: Action;
    children: ProjectInfoNode[];
};

export type ProjectInfoNode = FieldNode | NewType | SectionNode;

export type Action = "none" | "updated" | "added" | "removed";
