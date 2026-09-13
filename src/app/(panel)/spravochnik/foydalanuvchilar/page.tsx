import { requirePageUser } from "@/lib/auth";
import { listUsers } from "@/services/users";
import { listSiteOptions } from "@/services/sites";
import { UsersEditor } from "./UsersEditor";

export default async function UsersPage() {
  const user = await requirePageUser(["DIRECTOR"]);
  const [users, sites] = await Promise.all([listUsers(), listSiteOptions()]);

  return (
    <UsersEditor
      currentUserId={user.id}
      sites={sites}
      users={users.map((u) => ({
        id: u.id,
        name: u.name,
        login: u.login,
        role: u.role,
        isActive: u.isActive,
        siteIds: u.siteAssignments.map((a) => a.site.id),
        siteNames: u.siteAssignments.map((a) => a.site.name),
      }))}
    />
  );
}
