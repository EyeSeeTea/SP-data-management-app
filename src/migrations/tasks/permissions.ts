import { D2Api } from "../../types/d2-api";
import { Debug } from "../types";

export async function checkCurrentUserIsSuperadmin(api: D2Api, debug: Debug) {
    debug("Check that current user is superadmin");
    const currentUser = await api.currentUser.get({ fields: { authorities: true } }).getData();

    if (!currentUser.authorities.includes("ALL"))
        throw new Error("Only a user with authority ALL can run this migration");
}
