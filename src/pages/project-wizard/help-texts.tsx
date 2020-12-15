import React from "react";
import i18n from "../../locales";
import { link } from "../../utils/form";

// i18next-scanner: Colon (:) is the default namespace separator, disable when using the character

export const helpTexts = {
    generalInfo: i18n.t(
        `- Starred (*) items are required to be filled out
        - Award Number- refers to the first 5 digits of the project’s award code.  For example, 11111 would be the award number for code 11111AAHQ.
        - Subsequent Lettering- refers to the two letters after the award number in the award code.  For example, AA would be the subsequent lettering for code 11111AAHQ.
        - Additional Designation: In some instances, there are large projects that are split into multiple sectors or multiple locations for reporting. Use the 'Additional Designation' to designate different sectors or locations within the project. For example, if 11111AAHQ has three separate reporting sectors (11111AAHQ01, 11111AAHQ02, 11111AAHQ03), use the last two digits (01, 02, 03) in the 'Additional Designation' section.
        - Funders- to add funders, ensure you click the funder first and the orange arrow button second.`,
        { nsSeparator: false }
    ),
    organisationUnits: i18n.t(
        `- Locations- to add locations, ensure you click the location first and the orange arrow button second.`,
        { nsSeparator: false }
    ),
    sectors: i18n.t(`- Remember to add multiple sectors if your project has multiple sectors.`, {
        nsSeparator: false,
    }),
    indicators: (
        <p>
            {i18n.t(
                `For support understanding and choosing indicators, please refer to the list of activity indicators located at this link:`
            )}
            &nbsp;
            {link("http://todo.com")}
        </p>
    ),
    merIndicators: i18n.t(
        `- MER indicators must be selected in coordination with your Country Director and Regional Team.`,
        { nsSeparator: false }
    ),
    disaggregation: i18n.t(
        `For activity indicators that include a response to COVID-19 (examples: COVID-19 messaging, COVID-19 specific healthcare worker trainings, etc.), please select "yes" under the COVID-19 column. In the future, more disaggregations (in addition to new, returning, gender, and COVID-19) will be available.`,
        { nsSeparator: false }
    ),
    save: i18n.t(
        `If you need to correct an item in your project, please click the grey “Previous” button located on the bottom right side of the screen.`
    ),
};
