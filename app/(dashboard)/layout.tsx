import { getProfile, canAdminister } from "@/lib/auth/get-profile";
import LogoutButton from "@/components/LogoutButton";

const NAV = [
  {
    group: "Planning",
    items: [
      { href: "/content-planning", label: "Content Planning", ready: true },
      { href: "#", label: "Editorial Event Planning", ready: false },
      { href: "#", label: "Calendar Days", ready: false },
      { href: "#", label: "Special Campaigns", ready: false },
      { href: "#", label: "Duty & Beat Charts", ready: false },
    ],
  },
  {
    group: "Knowledge",
    items: [
      { href: "#", label: "Important Documents", ready: false },
      { href: "#", label: "Archive", ready: false },
      { href: "#", label: "Idea Bank", ready: false },
      { href: "#", label: "Journalism Awards", ready: false },
      { href: "#", label: "Resources", ready: false },
      { href: "#", label: "Case Studies", ready: false },
    ],
  },
  {
    group: "Team",
    items: [
      { href: "#", label: "Messages & Instructions", ready: false },
      { href: "#", label: "Blunders & Errors", ready: false },
      { href: "#", label: "Star of the Week", ready: false },
      { href: "#", label: "Contact Directory", ready: false },
      { href: "#", label: "Accounts", ready: false },
    ],
  },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { role, fullName, user } = await getProfile();
  const isAdmin = canAdminister(role);

  return (
    <div className="flex min-h-screen">
      <aside className="w-[250px] shrink-0 bg-paper-dim border-r border-rule py-4 flex flex-col">
        <div className="px-5 pb-4 border-b border-rule mb-2">
          <div className="font-serif text-[22px] font-bold leading-none">
            THE <span className="text-red">DESK</span>
          </div>
          <div className="text-[10px] uppercase tracking-[2px] text-ink-soft mt-1">
            Content Command
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {NAV.map((g) => (
            <div key={g.group} className="mb-1">
              <div className="text-[10px] uppercase tracking-[2px] text-ink-soft font-semibold px-5 pt-3 pb-1">
                {g.group}
              </div>
              {g.items.map((it) => (
                <a
                  key={it.label}
                  href={it.ready ? it.href : undefined}
                  className={`flex items-center justify-between px-5 py-2 text-[13.5px] border-l-[3px] ${
                    it.ready
                      ? "border-transparent text-ink-soft hover:bg-[#e6e1d3] cursor-pointer"
                      : "border-transparent text-rule-strong cursor-not-allowed"
                  }`}
                >
                  {it.label}
                  {!it.ready && (
                    <span className="text-[9px] uppercase tracking-[1px]">soon</span>
                  )}
                </a>
              ))}
            </div>
          ))}

          {isAdmin && (
            <div className="mb-1">
              <div className="text-[10px] uppercase tracking-[2px] text-ink-soft font-semibold px-5 pt-3 pb-1">
                Admin
              </div>
              <a
                href="/admin/labels"
                className="flex items-center px-5 py-2 text-[13.5px] text-ink-soft hover:bg-[#e6e1d3] cursor-pointer"
              >
                Labels & Text
              </a>
              <a
                href="/admin/users"
                className="flex items-center px-5 py-2 text-[13.5px] text-ink-soft hover:bg-[#e6e1d3] cursor-pointer"
              >
                Bulk User Import
              </a>
            </div>
          )}
        </div>

        {user && (
          <div className="px-5 pt-3 border-t border-rule">
            <div className="text-[12px] font-medium truncate">{fullName || user.email}</div>
            <div className="text-[10px] uppercase tracking-[1px] text-ink-soft mb-2">{role.replace("_", " ")}</div>
            <LogoutButton />
          </div>
        )}
      </aside>
      <main className="flex-1 p-8 min-w-0">{children}</main>
    </div>
  );
}
