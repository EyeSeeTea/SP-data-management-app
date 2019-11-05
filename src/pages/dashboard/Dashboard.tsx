import React from "react";
import i18n from "../../locales";
import PageHeader from "../../components/page-header/PageHeader";
import { useHistory } from "react-router";
import { History } from "history";
import { generateUrl } from "../../router";
import { DataSetForList } from "../../models/Project";
import "./Dashboard.css";

type DataSet = DataSetForList;

function goTo(history: History, url: string) {
    history.push(url);
}

const Link: React.FC<{ url: string }> = ({ url }) => {
    return (
        <a
            rel="noopener noreferrer"
            style={{ wordBreak: "break-all", textDecoration: "none" }}
            href={url}
            target="_blank"
        >
            {url}
        </a>
    );
};

function getConfig(history: History) {
    const columns = [
        { name: "displayName", text: i18n.t("Name"), sortable: true },
        { name: "publicAccess", text: i18n.t("Public access"), sortable: true },
        { name: "lastUpdated", text: i18n.t("Last updated"), sortable: true },
    ];

    const initialSorting = ["displayName", "asc"];

    const detailsFields = [
        { name: "displayName", text: i18n.t("Name") },
        { name: "displayDescription", text: i18n.t("Description") },
        { name: "created", text: i18n.t("Created") },
        {
            name: "createdBy",
            text: i18n.t("Created By"),
            getValue: (dataSet: DataSet) => `${dataSet.user.displayName} (${dataSet.user.id})`,
        },
        { name: "lastUpdated", text: i18n.t("Last update") },
        { name: "id", text: i18n.t("Id") },
        {
            name: "href",
            text: i18n.t("API link"),
            getValue: function getDataSetLink(dataSet: DataSet) {
                return <Link url={dataSet.href + ".json"} />;
            },
        },
    ];

    const actions = [
        {
            name: "details",
            text: i18n.t("Details"),
            multiple: false,
            type: "details",
            isPrimary: true,
        },
        {
            name: "data-entry",
            icon: "library_books",
            text: i18n.t("Go to Data Entry"),
            multiple: false,
        },
        {
            name: "dashboard",
            icon: "dashboard",
            text: i18n.t("Go to Dashboard"),
            multiple: false,
        },
        {
            name: "add-target-values",
            icon: "assignment",
            text: i18n.t("Add Target Values"),
            multiple: false,
        },
        {
            name: "download-data",
            icon: "cloud_download",
            text: i18n.t("Download Data"),
            multiple: false,
        },
        {
            name: "mer",
            icon: "description",
            text: i18n.t("Generate / Configure MER"),
            multiple: false,
        },
        {
            name: "edit",
            text: i18n.t("Edit"),
            multiple: false,
            // isActive: (d2, dataSet) => true,
            onClick: (dataSet: DataSet) =>
                history.push(generateUrl("projects.edit", { id: dataSet.id })),
        },
        {
            name: "delete",
            text: i18n.t("Delete"),
            multiple: true,
            onClick: (dataSets: DataSet[]) => {
                console.log("delete", dataSets);
            },
        },
    ];

    const help = i18n.t(
        `Please click on the grey arrow next to the chart/table title if you want to modify the layout.`
    );

    return { columns, initialSorting, detailsFields, actions, help };
}

const Dashboard: React.FC = () => {
    const history = useHistory();
    const goToLandingPage = () => goTo(history, "/");
    const config = getConfig(history);

    return (
        <React.Fragment>
            <PageHeader
                title={i18n.t("Dashboard")}
                help={config.help}
                onBackClick={goToLandingPage}
            />
        </React.Fragment>
    );
};

export default Dashboard;
