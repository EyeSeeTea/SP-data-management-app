import { useConfig } from "@dhis2/app-runtime";
import React from "react";
import i18n from "../../locales";

interface ErrorMessageProps {
    err: any;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = props => {
    const { err } = props;
    const { baseUrl } = useConfig();

    const errorMessage = err ? err.message || err.toString() : i18n.t("Unknown error");
    return (
        <span>
            {i18n.t("Error saving report")}: {errorMessage} ({i18n.t("session expired?")}{" "}
            <a
                style={{ color: "#FFF", fontWeight: "bold" }}
                rel="noopener noreferrer"
                target="_blank"
                href={baseUrl}
            >
                {i18n.t("Check")}
            </a>
            )
        </span>
    );
};
