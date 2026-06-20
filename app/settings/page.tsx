"use client";

import { createClient } from "@supabase/supabase-js";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FOREST, NEUTRAL_PILL } from "@/app/lib/oneEyrieColors";
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  ChevronRight,
  ClipboardCheck,
  Pencil,
  Plus,
  Repeat,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";
import InspectionTemplatesSection from "./components/InspectionTemplatesSection";
import RoomsAreasSection from "./components/RoomsAreasSection";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);


type SectionId =
  | "home"
  | "team"
  | "roomsAreas"
  | "templates"
  | "tasks"
  | "roles";

type ModalType = Exclude<SectionId, "home" | "roomsAreas" | "templates"> | null;

type AnyRecord = {
  id: number;
  [key: string]: any;
};

const gold = "#C8A96A";
const sidebar = "#211F1B";
const row = "#302D28";
const black = "#111111";

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SectionId>("home");
  const [search, setSearch] = useState("");
  const [modalType, setModalType] = useState<ModalType>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const [teamMembers, setTeamMembers] = useState<AnyRecord[]>([]);

  async function fetchTeamMembers() {
  const { data, error } = await supabase
    .from("team_members")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading team members:", error);
    return;
  }

  setTeamMembers(data || []);
}

useEffect(() => {
  async function checkAuth() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      window.location.href = "/login";
      return;
    }

    fetchTeamMembers();
  }

  checkAuth();
}, []);

  const [tasks, setTasks] = useState<AnyRecord[]>([
    {
      id: 1,
      name: "RPM Inspection",
      frequency: "Every 90 Days",
      assignedTo: "Housekeeping",
      nextDue: "2026-07-01",
      status: "Active",
    },
    {
      id: 2,
      name: "Pool Inspection",
      frequency: "Daily",
      assignedTo: "Maintenance",
      nextDue: "2026-06-09",
      status: "Active",
    },
  ]);

  const [roles, setRoles] = useState<AnyRecord[]>([
    {
      id: 1,
      name: "Admin / GM",
      access: "Full Access",
      status: "Active",
    },
    {
      id: 2,
      name: "Manager",
      access: "Operations + Reports",
      status: "Active",
    },
    {
      id: 3,
      name: "Front Desk Agent",
      access: "Lost & Found + Pass-On Log",
      status: "Active",
    },
    {
      id: 4,
      name: "Housekeeper",
      access: "Inspections Only",
      status: "Active",
    },
    {
      id: 5,
      name: "Inspector",
      access: "Inspections Only",
      status: "Active",
    },
    {
      id: 6,
      name: "RPM/Maintenance",
      access: "Maintenance Only",
      status: "Active",
    },
  ]);

    const settingsCards = [
    {
      id: "team" as SectionId,
      title: "Team Members",
      subtitle: "Add, edit, and manage users, departments, and access.",
      icon: <Users size={26} />,
    },
    {
      id: "roomsAreas" as SectionId,
      title: "Rooms & Areas",
      subtitle: "Set up guest rooms, public areas, and hotel locations.",
      icon: <Building2 size={26} />,
    },
    {
      id: "templates" as SectionId,
      title: "Inspection Templates",
      subtitle: "Create inspection templates and checklist categories.",
      icon: <ClipboardCheck size={26} />,
    },
    {
      id: "tasks" as SectionId,
      title: "Recurring Tasks / Scheduler",
      subtitle: "Set up recurring hotel tasks like Outlook calendar events.",
      icon: <Repeat size={26} />,
    },
    {
      id: "roles" as SectionId,
      title: "Roles & Permissions",
      subtitle: "Manage simple role access for each department.",
      icon: <ShieldCheck size={26} />,
    },
  ];

  const sectionTitle = settingsCards.find((card) => card.id === activeSection);

  const currentRows = useMemo(() => {
    let rows: AnyRecord[] = [];

    if (activeSection === "team") rows = teamMembers;
    if (activeSection === "tasks") rows = tasks;
    if (activeSection === "roles") rows = roles;

    if (!search.trim()) return rows;

    return rows.filter((item) =>
      JSON.stringify(item).toLowerCase().includes(search.toLowerCase())
    );
  }, [activeSection, search, teamMembers, tasks, roles]);

  function openNew(type: ModalType) {
    setModalType(type);
    setEditingId(null);
    setDraft(getEmptyDraft(type));
  }

  function teamMemberToDraft(item: AnyRecord): Record<string, string> {
    return {
      firstName: item.first_name || item.firstName || "",
      lastName: item.last_name || item.lastName || "",
      email: item.email || "",
      phone: item.phone || "",
      department: item.department || "Front Desk",
      role: item.role || "Front Desk Agent",
      status: item.status || "Active",
      can_login:
        item.can_login === true || item.can_login === "true" ? "true" : "false",
      username: item.username || "",
      tempPassword: "",
    };
  }

  function openEdit(type: ModalType, item: AnyRecord) {
    setModalType(type);
    setEditingId(item.id);
    setDraft(type === "team" ? teamMemberToDraft(item) : { ...item });
  }

  function closeModal() {
    setModalType(null);
    setEditingId(null);
    setDraft({});
  }

  function updateDraft(key: string, value: string) {
    setDraft((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function getEmptyDraft(type: ModalType): Record<string, string> {
    if (type === "team") {
      
      return {
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        department: "Front Desk",
        role: "Front Desk Agent",
        status: "Active",

        can_login: "false",
        username: "",
        tempPassword: "",
      };
    }

    if (type === "tasks") {
      return {
        name: "",
        frequency: "Weekly",
        assignedTo: "Maintenance",
        nextDue: getLocalDateString(),
        status: "Active",
      };
    }

    if (type === "roles") {
      return {
        name: "",
        access: "View Only",
        status: "Active",
      };
    }

    return {};
  }

  function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

async function saveItem() {
  if (!modalType) return;

  if (modalType === "team") {
    const payload = {
      first_name: draft.firstName || "",
      last_name: draft.lastName || "",
      email: draft.email || "",
      phone: draft.phone || "",
      department: draft.department || "Front Desk",
      role: draft.role || "Front Desk Agent",
      status: draft.status || "Active",
      can_login: draft.can_login === "true",
      username: draft.username || "",
      tempPassword: draft.tempPassword || "",
    };

    const response = await fetch(
      editingId ? "/api/update-user" : "/api/create-user",
      {
        method: editingId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editingId ? { id: editingId, ...payload } : payload),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      alert(
        result.error ||
          (editingId ? "Unable to update user" : "Unable to create user")
      );
      return;
    }

    await fetchTeamMembers();
    closeModal();
    return;
  }

  const newItem = {
    ...draft,
    id: editingId ?? Date.now(),
  };

  if (modalType === "tasks") {
    setTasks((prev) =>
      editingId
        ? prev.map((item) => (item.id === editingId ? newItem : item))
        : [...prev, newItem]
    );
  }

  if (modalType === "roles") {
    setRoles((prev) =>
      editingId
        ? prev.map((item) => (item.id === editingId ? newItem : item))
        : [...prev, newItem]
    );
  }

  closeModal();
}

  function deleteItem(type: ModalType, id: number) {
    if (!type) return;

    if (type === "team") {
      setTeamMembers((prev) => prev.filter((item) => item.id !== id));
    }

    if (type === "tasks") {
      setTasks((prev) => prev.filter((item) => item.id !== id));
    }

    if (type === "roles") {
      setRoles((prev) => prev.filter((item) => item.id !== id));
    }
  }

  function getNewButtonLabel() {
    if (activeSection === "team") return "New User";
    if (activeSection === "tasks") return "New Task";
    if (activeSection === "roles") return "New Role";

    return "New";
  }

 function getName(item: AnyRecord) {
  if (activeSection === "team") {
    return (
      `${item.first_name || item.firstName || ""} ${
        item.last_name || item.lastName || ""
      }`.trim() || "Unnamed User"
    );
  }

    return item.name || "Untitled";
  }

  function renderTable() {
    if (activeSection === "home") return null;

    return (
      <div style={sectionPanel}>
        <div style={sectionToolbar}>
          <div style={searchWrap}>
            <Search
              size={18}
              color="#E5E7EB"
              style={{ position: "absolute", left: 16, top: 14 }}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${sectionTitle?.title.toLowerCase()}...`}
              style={searchInput}
            />
          </div>

          <button
            type="button"
            style={primaryButton}
            onClick={() => openNew(activeSection as ModalType)}
          >
            <Plus size={16} />
            {getNewButtonLabel()}
          </button>
        </div>

        <div style={tableHeader}>
          <div>Name</div>
          <div>Type / Role</div>
          <div>Department / Location</div>
          <div>Status</div>
          <div style={{ textAlign: "right" }}>Actions</div>
        </div>

        {currentRows.map((item) => (
          <div key={item.id} style={tableRow}>
            <div>
              <div style={rowTitle}>{getName(item)}</div>
              {activeSection === "team" && (
                <div style={rowSub}>{item.email || "No email"}</div>
              )}
              {activeSection === "tasks" && (
                <div style={rowSub}>Next due: {item.nextDue}</div>
              )}
            </div>

            <div style={rowText}>
              {activeSection === "team" && item.role}
              {activeSection === "tasks" && item.frequency}
              {activeSection === "roles" && item.access}
            </div>

            <div style={rowText}>
              {activeSection === "team" && item.department}
              {activeSection === "tasks" && item.assignedTo}
              {activeSection === "roles" && "System"}
            </div>

            <div>
              <span
                style={{
                  ...statusPill,
                  borderColor: item.status === "Active" ? FOREST.border : NEUTRAL_PILL.border,
                  color: item.status === "Active" ? FOREST.text : NEUTRAL_PILL.text,
                }}
              >
                {item.status}
              </span>
            </div>

            <div style={actionCell}>
              <button
                type="button"
                style={iconButton}
                onClick={() => openEdit(activeSection as ModalType, item)}
              >
                <Pencil size={15} />
              </button>

              <button
                type="button"
                style={iconButton}
                onClick={() => deleteItem(activeSection as ModalType, item.id)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}

        {currentRows.length === 0 && (
          <div style={emptyState}>No records found.</div>
        )}
      </div>
    );
  }

    function renderModalFields() {
    if (modalType === "team") {
      return (
        <>
          <div style={twoCol}>
            <input
              value={draft.firstName || ""}
              onChange={(e) => updateDraft("firstName", e.target.value)}
              placeholder="First Name"
              style={input}
            />
            <input
              value={draft.lastName || ""}
              onChange={(e) => updateDraft("lastName", e.target.value)}
              placeholder="Last Name"
              style={input}
            />
          </div>

          <input
            value={draft.email || ""}
            onChange={(e) => updateDraft("email", e.target.value)}
            placeholder="Email"
            style={input}
          />

          <input
            value={draft.phone || ""}
            onChange={(e) => updateDraft("phone", e.target.value)}
            placeholder="Phone"
            style={input}
          />

          <div style={twoCol}>
            <select
              value={draft.department || "Front Desk"}
              onChange={(e) => updateDraft("department", e.target.value)}
              style={input}
            >
              <option>Management</option>
              <option>Front Desk</option>
              <option>Housekeeping</option>
              <option>Maintenance</option>
              <option>Sales</option>
              <option>Food & Beverage</option>
            </select>

            <select
              value={draft.role || "Front Desk Agent"}
              onChange={(e) => updateDraft("role", e.target.value)}
              style={input}
            >
              <option>Admin / GM</option>
              <option>Manager</option>
              <option>Front Desk Agent</option>
              <option>Housekeeper</option>
              <option>Inspector</option>
              <option>RPM/Maintenance</option>
              <option>Read Only</option>
            </select>
          </div>

          <select
            value={draft.status || "Active"}
            onChange={(e) => updateDraft("status", e.target.value)}
            style={input}
          >
            <option>Active</option>
            <option>Inactive</option>
          </select>

          <label
  style={{
    display: "flex",
    alignItems: "center",
    gap: "10px",
    color: "#FFFFFF",
    fontWeight: 700,
    marginTop: "6px",
  }}
>
  <input
    type="checkbox"
    checked={draft.can_login === "true"}
    onChange={(e) =>
      updateDraft("can_login", e.target.checked ? "true" : "false")
    }
  />
  Allow Login
</label>

{draft.can_login === "true" && (
  <div style={twoCol}>
    <input
      value={draft.username || ""}
      onChange={(e) => updateDraft("username", e.target.value)}
      placeholder="Username"
      style={input}
    />

    <input
      type="password"
      value={draft.tempPassword || ""}
      onChange={(e) => updateDraft("tempPassword", e.target.value)}
      placeholder={editingId ? "New Password (optional)" : "Temporary Password"}
      style={input}
    />
  </div>
)}
        </>
      );
    }

    if (modalType === "tasks") {
      return (
        <>
          <input
            value={draft.name || ""}
            onChange={(e) => updateDraft("name", e.target.value)}
            placeholder="Task Name"
            style={input}
          />

          <div style={twoCol}>
            <select
              value={draft.frequency || "Weekly"}
              onChange={(e) => updateDraft("frequency", e.target.value)}
              style={input}
            >
              <option>Daily</option>
              <option>Weekly</option>
              <option>Monthly</option>
              <option>Quarterly</option>
              <option>Semi Annual</option>
              <option>Annual</option>
              <option>Every 90 Days</option>
            </select>

            <select
              value={draft.assignedTo || "Maintenance"}
              onChange={(e) => updateDraft("assignedTo", e.target.value)}
              style={input}
            >
              <option>Management</option>
              <option>Front Desk</option>
              <option>Housekeeping</option>
              <option>Maintenance</option>
              <option>Sales</option>
            </select>
          </div>

          <input
            type="date"
            value={draft.nextDue || getLocalDateString()}
            onChange={(e) => updateDraft("nextDue", e.target.value)}
            style={input}
          />

          <select
            value={draft.status || "Active"}
            onChange={(e) => updateDraft("status", e.target.value)}
            style={input}
          >
            <option>Active</option>
            <option>Paused</option>
            <option>Inactive</option>
          </select>
        </>
      );
    }

    if (modalType === "roles") {
      return (
        <>
          <input
            value={draft.name || ""}
            onChange={(e) => updateDraft("name", e.target.value)}
            placeholder="Role Name"
            style={input}
          />

          <select
            value={draft.access || "View Only"}
            onChange={(e) => updateDraft("access", e.target.value)}
            style={input}
          >
            <option>Full Access</option>
            <option>Operations + Reports</option>
            <option>Lost & Found + Pass-On Log</option>
            <option>Inspections Only</option>
            <option>Maintenance Only</option>
            <option>View Only</option>
          </select>

          <select
            value={draft.status || "Active"}
            onChange={(e) => updateDraft("status", e.target.value)}
            style={input}
          >
            <option>Active</option>
            <option>Inactive</option>
          </select>
        </>
      );
    }

    return null;
  }

    return (
    <div style={appShell}>
      <aside style={sidebarStyle}>
        <div style={{ marginBottom: "42px" }}>
          <div style={{ color: gold, fontSize: "28px", fontWeight: "bold" }}>
            ONE
          </div>
          <div style={{ color: gold, letterSpacing: "4px", fontSize: "13px" }}>
            — EYRIE —
          </div>
        </div>

        {[
          "Dashboard",
          "Lost & Found",
          "Pass-On Log",
          "Inspections",
          "Maintenance",
          "Settings",
        ].map((item) => (
          <div
            key={item}
            className="nav-item"
            style={{
              padding: "14px 16px",
              borderRadius: "10px",
              marginBottom: "8px",
              background: item === "Settings" ? gold : "transparent",
              color: item === "Settings" ? "#111111" : "#FFFFFF",
              fontWeight: item === "Settings" ? "bold" : "normal",
              transition: "all 0.18s ease",
            }}
          >
            <Link
              href={
                item === "Lost & Found"
                  ? "/"
                  : item === "Pass-On Log"
                  ? "/pass-on-log"
                  : item === "Settings"
                  ? "/settings"
                  : "#"

              }
              style={{
                color: "inherit",
                textDecoration: "none",
                display: "block",
                width: "100%",
              }}
            >
              {item}
            </Link>
          </div>
        ))}
      </aside>

      <main style={mainStyle}>
        <div style={pageHeader}>
          <div>
            <h1 style={title}>Settings</h1>
            <p style={subtitle}>
              Configure One Eyrie platform settings
            </p>
          </div>
        </div>

        {activeSection === "home" ? (
          <div style={settingsList}>
            {settingsCards.map((card) => (
              <button
                key={card.id}
                type="button"
                style={settingsCard}
                onClick={() => {
                  setSearch("");
                  setActiveSection(card.id);
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = gold;
                  e.currentTarget.style.boxShadow =
                    "0 0 18px rgba(200,169,106,0.22)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#3A352E";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div style={cardIcon}>{card.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={cardTitle}>{card.title}</div>
                  <div style={cardSubtitle}>{card.subtitle}</div>
                </div>
                <ChevronRight size={22} color={gold} />
              </button>
            ))}
          </div>
        ) : (
          <>
            <div style={sectionHeader}>
              <button
                type="button"
                style={backButton}
                onClick={() => {
                  setActiveSection("home");
                  setSearch("");
                }}
              >
                <ArrowLeft size={16} />
                Back to Settings
              </button>

              <div>
                <h2 style={sectionTitleStyle}>{sectionTitle?.title}</h2>
                <p style={sectionSubtitleStyle}>{sectionTitle?.subtitle}</p>
              </div>
            </div>

            {activeSection === "roomsAreas" ? (
              <RoomsAreasSection
                styles={{
                  sectionPanel,
                  sectionToolbar,
                  searchWrap,
                  searchInput,
                  primaryButton,
                  secondaryButton,
                  tableHeader,
                  tableRow,
                  rowTitle,
                  rowText,
                  statusPill,
                  actionCell,
                  iconButton,
                  emptyState,
                  modalOverlay,
                  modalBox,
                  modalHeader,
                  closeButton,
                  formStack,
                  twoCol,
                  input,
                  modalFooter,
                }}
              />
            ) : activeSection === "templates" ? (
              <InspectionTemplatesSection
                styles={{
                  sectionPanel,
                  sectionToolbar,
                  searchWrap,
                  searchInput,
                  primaryButton,
                  secondaryButton,
                  tableHeader,
                  tableRow,
                  rowTitle,
                  rowText,
                  statusPill,
                  actionCell,
                  iconButton,
                  emptyState,
                  modalOverlay,
                  modalBox,
                  modalHeader,
                  closeButton,
                  formStack,
                  twoCol,
                  input,
                  modalFooter,
                }}
              />
            ) : (
              renderTable()
            )}
          </>
        )}

        {modalType && (
          <div style={modalOverlay}>
            <div style={modalBox}>
              <div style={modalHeader}>
                <h2 style={{ margin: 0 }}>
                  {editingId ? "Edit" : "New"}{" "}
                  {modalType === "team" && "Team Member"}
                  {modalType === "tasks" && "Recurring Task"}
                  {modalType === "roles" && "Role"}
                </h2>

                <button type="button" style={closeButton} onClick={closeModal}>
                  <X size={22} />
                </button>
              </div>

              <div style={formStack}>{renderModalFields()}</div>

              <div style={modalFooter}>
                <button type="button" style={secondaryButton} onClick={closeModal}>
                  Cancel
                </button>

                <button type="button" style={primaryButton} onClick={saveItem}>
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const appShell: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  background: black,
  color: "#FFFFFF",
  fontFamily:
    "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
};

const sidebarStyle: React.CSSProperties = {
  width: "240px",
  background: sidebar,
  borderRight: "1px solid #2A2A2A",
  display: "flex",
  flexDirection: "column",
  padding: "26px 18px",
};

const logoBox: React.CSSProperties = {
  marginBottom: "42px",
};

const logoText: React.CSSProperties = {
  color: gold,
  fontWeight: 800,
  fontSize: "28px",
  letterSpacing: "2px",
};

const logoSub: React.CSSProperties = {
  color: gold,
  fontSize: "13px",
  letterSpacing: "5px",
  marginTop: "4px",
};

const navStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const navButton: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#FFFFFF",
  textAlign: "left",
  padding: "13px 14px",
  borderRadius: "10px",
  fontWeight: 700,
  fontSize: "15px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "10px",
};

const activeNav: React.CSSProperties = {
  background: gold,
  color: "#211F1B",
};

const mainStyle: React.CSSProperties = {
  flex: 1,
  padding: "54px 64px",
};

const pageHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  borderBottom: "1px solid #2A2A2A",
  paddingBottom: "26px",
  marginBottom: "24px",
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: "36px",
  fontWeight: 800,
};

const subtitle: React.CSSProperties = {
  marginTop: "8px",
  color: "#C9C9C9",
  fontSize: "16px",
};

const settingsList: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  maxWidth: "1100px",
};

const settingsCard: React.CSSProperties = {
  background: row,
  border: "1px solid #3A352E",
  color: "#FFFFFF",
  borderRadius: "14px",
  padding: "26px",
  display: "flex",
  alignItems: "center",
  gap: "22px",
  textAlign: "left",
  cursor: "pointer",
  transition: "all 0.18s ease",
};

const cardIcon: React.CSSProperties = {
  width: "58px",
  height: "58px",
  borderRadius: "50%",
  background: "#211F1B",
  color: gold,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const cardTitle: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: 800,
};

const cardSubtitle: React.CSSProperties = {
  color: "#C9C9C9",
  marginTop: "6px",
  fontSize: "15px",
};

const sectionHeader: React.CSSProperties = {
  marginBottom: "22px",
};

const backButton: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #3A352E",
  color: gold,
  borderRadius: "999px",
  padding: "10px 14px",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  fontWeight: 700,
  marginBottom: "18px",
};

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "30px",
  fontWeight: 800,
};

const sectionSubtitleStyle: React.CSSProperties = {
  marginTop: "6px",
  color: "#C9C9C9",
};

const sectionPanel: React.CSSProperties = {
  background: "#151515",
  border: "1px solid #3A352E",
  borderRadius: "16px",
  padding: "20px",
};

const sectionToolbar: React.CSSProperties = {
  display: "flex",
  gap: "14px",
  marginBottom: "18px",
};

const searchWrap: React.CSSProperties = {
  flex: 1,
  position: "relative",
};

const searchInput: React.CSSProperties = {
  width: "100%",
  height: "46px",
  background: black,
  color: "#FFFFFF",
  border: "1px solid #3A352E",
  borderRadius: "12px",
  padding: "0 14px 0 46px",
  outline: "none",
  fontSize: "15px",
  fontWeight: 600,
};

const primaryButton: React.CSSProperties = {
  background: gold,
  border: "1px solid #E0C47B",
  color: "#211F1B",
  borderRadius: "12px",
  padding: "0 18px",
  height: "46px",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: "14px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
};

const tableHeader: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.4fr 1fr 1fr 0.7fr 0.7fr",
  color: gold,
  fontWeight: 800,
  fontSize: "13px",
  padding: "12px 14px",
  borderBottom: "1px solid #3A352E",
};

const tableRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.4fr 1fr 1fr 0.7fr 0.7fr",
  alignItems: "center",
  padding: "16px 14px",
  borderBottom: "1px solid #2A2A2A",
  background: row,
  borderRadius: "10px",
  marginTop: "10px",
};

const rowTitle: React.CSSProperties = {
  fontWeight: 800,
  fontSize: "15px",
};

const rowSub: React.CSSProperties = {
  color: "#C9C9C9",
  fontSize: "12px",
  marginTop: "3px",
};

const rowText: React.CSSProperties = {
  color: "#E5E7EB",
  fontSize: "14px",
  fontWeight: 600,
};

const statusPill: React.CSSProperties = {
  border: "1px solid",
  borderRadius: "999px",
  padding: "5px 10px",
  fontSize: "12px",
  fontWeight: 800,
};

const actionCell: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "8px",
};

const iconButton: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#FFFFFF",
  cursor: "pointer",
  padding: "7px",
};

const emptyState: React.CSSProperties = {
  padding: "28px",
  color: "#C9C9C9",
  textAlign: "center",
};

const modalOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.72)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 999,
};

const modalBox: React.CSSProperties = {
  width: "720px",
  background: row,
  border: `1px solid ${gold}`,
  borderRadius: "16px",
  boxShadow: "0 0 26px rgba(200,169,106,0.25)",
  padding: "24px",
};

const modalHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "22px",
};

const closeButton: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#FFFFFF",
  cursor: "pointer",
};

const formStack: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "14px",
};

const twoCol: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "14px",
};

const input: React.CSSProperties = {
  width: "100%",
  height: "46px",
  background: black,
  color: "#FFFFFF",
  border: "1px solid #4A4A4A",
  borderRadius: "10px",
  padding: "0 12px",
  fontSize: "14px",
  fontWeight: 600,
  outline: "none",
};

const modalFooter: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
  marginTop: "24px",
};

const secondaryButton: React.CSSProperties = {
  background: "transparent",
  border: `1px solid ${gold}`,
  color: gold,
  borderRadius: "12px",
  padding: "0 18px",
  height: "46px",
  cursor: "pointer",
  fontWeight: 800,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  fontSize: "14px",
};