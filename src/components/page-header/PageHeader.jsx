import React from "react";
import PropTypes from "prop-types";
import i18n from "@dhis2/d2-i18n";

import Typography from "@material-ui/core/Typography";
import IconButton from "@material-ui/core/IconButton";
import Icon from "@material-ui/core/Icon";
import HelpButton from "../help-button/HelpButton";

const iconStyle = { paddingTop: 10, marginBottom: 5 };

function PageHeader({ variant, title, onBackClick, help, pageVisited }) {
    return (
        <div>
            <IconButton
                onClick={onBackClick}
                color="secondary"
                aria-label={i18n.t("Back")}
                style={iconStyle}
            >
                <Icon color="primary">arrow_back</Icon>
            </IconButton>

            <Typography variant={variant} style={{ display: "inline-block", fontWeight: 300 }}>
                {title}
                {help && (
                    <HelpButton
                        title={`${title} - ${i18n.t("Help")}`}
                        contents={help}
                        pageVisited={pageVisited}
                    />
                )}
            </Typography>
        </div>
    );
}

PageHeader.propTypes = {
    variant: PropTypes.string,
    title: PropTypes.string.isRequired,
    onBackClick: PropTypes.func.isRequired,
    help: PropTypes.string,
    pageVisited: PropTypes.bool,
};

PageHeader.defaultProps = {
    variant: "h5",
};

export default PageHeader;
