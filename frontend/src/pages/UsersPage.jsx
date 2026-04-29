import { useEffect, useMemo, useRef, useState } from "react";
import api from "../api/axiosClient";
import LoadingSpinner from "../components/LoadingSpinner";
import { useAuth } from "../context/AuthContext";
import useMasterData from "../hooks/useMasterData";
import { logApiError } from "../utils/apiError";
import { exportRowsToExcel } from "../utils/exportExcel";
import { sortByNewestFirst } from "../utils/recordOrdering";

function getInitials(name) {
  return (name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "NA";
}

function UsersPage() {
  const { user } = useAuth();
  const masterData = useMasterData();
  const menuRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [activeMenuUserId, setActiveMenuUserId] = useState(null);
  const [roleFilter, setRoleFilter] = useState("all");
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "sales" });
  const canManageUsers = user?.role === "admin";
  const roleOptions = useMemo(
    () => [
      { value: "all", label: "All Roles" },
      ...masterData.roles.map((role) => ({
        value: role.value,
        label: role.label
      }))
    ],
    [masterData.roles]
  );

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/users");
      const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      setUsers(sortByNewestFirst(items));
    } catch (error) {
      logApiError(error, "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setActiveMenuUserId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredUsers = useMemo(() => {
    if (roleFilter === "all") return users;
    return users.filter((user) => user.role === roleFilter);
  }, [users, roleFilter]);

  const submitUser = async (event) => {
    event.preventDefault();
    if (!canManageUsers) return;
    setSubmitting(true);
    try {
      if (editingUserId) {
        const payload = {
          name: form.name,
          email: form.email,
          role: form.role
        };
        if (form.password) payload.password = form.password;
        await api.put(`/users/${editingUserId}`, payload);
      } else {
        await api.post("/users", form);
      }
      setForm({ name: "", email: "", password: "", role: "sales" });
      setEditingUserId(null);
      setIsCreateModalOpen(false);
      await fetchUsers();
    } catch (error) {
      logApiError(error, "User save failed");
    } finally {
      setSubmitting(false);
    }
  };

  const exportUsers = () => {
    exportRowsToExcel(
      `users_${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { key: "id", header: "ID" },
        { key: "name", header: "Name" },
        { key: "email", header: "Email" },
        { key: "role", header: "Role" },
        { key: "createdAt", header: "Created At" }
      ],
      filteredUsers.map((user) => ({
        ...user,
        status: "Active",
        createdAt: user.createdAt ? new Date(user.createdAt).toLocaleString() : ""
      }))
    );
  };

  const toggleActionMenu = (userId) => {
    if (activeMenuUserId === userId) {
      setActiveMenuUserId(null);
      return;
    }

    setActiveMenuUserId(userId);
  };

  const onEditUser = (user) => {
    setEditingUserId(user.id);
    setForm({
      name: user.name || "",
      email: user.email || "",
      password: "",
      role: user.role || "sales"
    });
    setIsCreateModalOpen(true);
    setActiveMenuUserId(null);
  };

  const onDeleteUser = async (userId) => {
    if (!window.confirm("Delete this user?")) return;
    try {
      await api.delete(`/users/${userId}`);
      await fetchUsers();
    } catch (error) {
      logApiError(error, "Failed to delete user");
    }
    setActiveMenuUserId(null);
  };

  return (
    <div className="users-page">
      <section className="users-card users-header-card">
        <div className="users-header-top">
          <h2>User Management</h2>
          <div className="users-header-actions">
            <button className="users-btn users-btn-secondary" onClick={exportUsers}>Export to Excel</button>
            {canManageUsers && (
              <button
                className="users-btn users-btn-primary"
                onClick={() => {
                  setEditingUserId(null);
                  setForm({ name: "", email: "", password: "", role: "sales" });
                  setIsCreateModalOpen(true);
                }}
              >
                Create User
              </button>
            )}
          </div>
        </div>

        <div className="users-filter-row">
          <label htmlFor="roleFilter">Filter by Role</label>
          <select id="roleFilter" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="users-card">
        <div className="users-list-header">
          <h3>Users</h3>
          <span>{filteredUsers.length} records</span>
        </div>

        {loading ? <div className="users-loading"><LoadingSpinner /></div> : (
          <div className="users-list-wrap" ref={menuRef}>
            <div className="users-list">
            {filteredUsers.map((user) => (
              <article key={user.id} className="user-item-card">
                <div className="user-item-left">
                  <span className="user-avatar">{getInitials(user.name)}</span>
                  <div className="user-info">
                    <p className="user-name">{user.name}</p>
                    <p className="user-email">{user.email}</p>
                  </div>
                </div>

                <div className="user-item-right">
                  <span className={`user-role-badge role-${user.role}`}>{user.role}</span>
                  <span className="user-status-badge active">Active</span>
                    {canManageUsers && (
                      <div className="user-menu">
                        <button
                          type="button"
                          className="user-menu-trigger"
                          aria-label={`Open actions for ${user.name}`}
                          onClick={() => toggleActionMenu(user.id)}
                        >
                          ...
                        </button>
                        {activeMenuUserId === user.id && (
                          <div className="user-menu-panel">
                            <button type="button" onClick={() => onEditUser(user)}>Edit</button>
                            <button type="button" className="danger" onClick={() => onDeleteUser(user.id)}>Delete</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              ))}

            {!filteredUsers.length && (
              <div className="users-empty-state">
                <p>No users found for selected role.</p>
              </div>
            )}
            </div>
          </div>
        )}
      </section>

      {isCreateModalOpen && canManageUsers && (
        <div className="users-modal-overlay">
          <div className="users-modal-card">
            <div className="users-modal-head">
              <div>
                <h3>{editingUserId ? "Edit User" : "Create New User"}</h3>
                <p>{editingUserId ? "This updates a user record." : "This submits a POST request to `/users`."}</p>
              </div>
              <button
                className="users-modal-close-btn"
                onClick={() => setIsCreateModalOpen(false)}
                disabled={submitting}
              >
                Close
              </button>
            </div>

            <form className="users-form-grid" onSubmit={submitUser}>
              <div>
                <label className="users-field-label">Name</label>
                <input className="users-input" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
              </div>
              <div>
                <label className="users-field-label">Email</label>
                <input className="users-input" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} required />
              </div>
              <div>
                <label className="users-field-label">Password</label>
                <input className="users-input" type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} required={!editingUserId} />
              </div>
              <div>
                <label className="users-field-label">Role</label>
                <select className="users-input" value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}>
                  {masterData.roles.map((role) => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
              </div>
              <div className="users-form-actions">
                <button
                  type="button"
                  className="users-btn users-btn-secondary"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button className="users-btn users-btn-primary min-width" disabled={submitting}>
                  {submitting ? "Saving..." : editingUserId ? "Save Changes" : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default UsersPage;
