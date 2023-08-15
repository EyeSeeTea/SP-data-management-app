import { AppConfig } from "./components/app/AppConfig";

export const appConfig: AppConfig = {
    appKey: "data-management-app",
    appearance: {
        showShareButton: false,
    },
    app: {
        notifyEmailOnProjectSave: [["pmt", "samaritan.org"].join("@")],
    },
    feedback: {
        repositories: {
            clickUp: {
                listId: "65645708",
                title: "[User feedback] {title}",
                body: "## dhis2\n\nUsername: {username}\n\n{body}",
                status: "Issues",
            },
        },
        layoutOptions: {
            showContact: false,
            descriptionTemplate:
                "## Summary\n\n## Steps to reproduce\n\n## Actual results\n\n## Expected results\n\n",
        },
    },
};
