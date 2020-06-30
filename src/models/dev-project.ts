import md5 from "md5";
import { D2Api, DataValueSetsPostRequest } from "../types/d2-api";
import _ from "lodash";
import Project from "./Project";
import moment from "moment";

type DataValue = DataValueSetsPostRequest["dataValues"][number];

function getRandomInt(min: number, max: number): number {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function getDevProject(initialProject: Project, enabled: boolean) {
    if (!enabled) return initialProject;
    const awardNumber = getRandomInt(10000, 99999).toString();

    return initialProject
        .set("parentOrgUnit", {
            path: "/J0hschZVMBt/eu2XF73JOzl",
            id: "eu2XF73JOzl",
            displayName: "Bahamas",
        })
        .set("sectors", [
            { id: "mGQ5ckOTU8A", displayName: "Agriculture", code: "SECTOR_AGRICULTURE" },
            { id: "GkiSljtLcOI", displayName: "Livelihood", code: "SECTOR_LIVELIHOOD" },
        ])
        .set(
            "dataElementsSelection",
            initialProject.dataElementsSelection
                .updateSelectedWithRelations("mGQ5ckOTU8A", ["WS8XV4WWPE7", "ik0ICagvIjm"])
                .dataElements.updateSelectedWithRelations("GkiSljtLcOI", ["We61YNYyOX0"])
                .dataElements
        )
        .set(
            "dataElementsMER",
            initialProject.dataElementsMER.updateSelected({ mGQ5ckOTU8A: ["ik0ICagvIjm"] })
        )
        .set("name", "0Test1-" + awardNumber)
        .set("description", "Some description")
        .set("awardNumber", awardNumber)
        .set("subsequentLettering", "en")
        .set("speedKey", "key1")
        .set(
            "startDate",
            moment()
                .startOf("month")
                .subtract(1, "month")
        )
        .set(
            "endDate",
            moment()
                .add(3, "month")
                .endOf("month")
        )
        .set("locations", [{ id: "GG0k0oNhgS7", displayName: "Abaco" }])
        .set("funders", [
            { id: "OKEZCrPzqph", displayName: "Atlas Copco" },
            { id: "em8NIwi0KvM", displayName: "Agridius Foundation" },
        ]);
}

export function getDevMerReport() {
    return {
        date: moment(),
        orgUnit: {
            path: "/J0hschZVMBt/eu2XF73JOzl",
            id: "eu2XF73JOzl",
            displayName: "Bahamas",
        },
    };
}

export async function saveDataValues(api: D2Api, project: Project) {
    const { dataSets } = project;
    if (!dataSets) return;

    const dataElements = project.getSelectedDataElements();
    const categoryCombosById = _(project.config.categoryCombos.default)
        .concat(project.config.categoryCombos.genderNewRecurring)
        .keyBy(cc => cc.id);
    const targetActualByName = _(project.config.categoryCombos.targetActual.categoryOptionCombos)
        .map(coc => [coc.displayName, coc.id])
        .fromPairs();
    const dataSetsInfo = [
        { dataSet: dataSets.target, attrCoc: targetActualByName.getOrFail("Target") },
        { dataSet: dataSets.actual, attrCoc: targetActualByName.getOrFail("Actual") },
    ];

    const dataValues = _.flatMap(dataSetsInfo, info => {
        const orgUnit = project.orgUnit;
        if (!orgUnit) return [];

        return _.flatMap(project.getPeriods(), period => {
            return _.flatMap(dataElements, de => {
                const cocs = categoryCombosById.getOrFail(de.categoryCombo.id).categoryOptionCombos;

                return cocs.map(coc => {
                    const key = [de.id, coc.id, info.attrCoc, period.id].join("-");
                    const md5hash = md5(key);
                    const value = (parseInt(md5hash.slice(0, 8), 16) % 9) + 1;

                    const dataValue: DataValue = {
                        dataElement: de.id,
                        value: value.toString(),
                        categoryOptionCombo: coc.id,
                        orgUnit: orgUnit.id,
                        period: period.id,
                        attributeOptionCombo: info.attrCoc,
                    };

                    return dataValue;
                });
            });
        });
    });

    await api.dataValues.postSet({ force: true }, { dataValues }).getData();

    api.analytics.run();
}
