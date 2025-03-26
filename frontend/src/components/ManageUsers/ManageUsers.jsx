import React, { useContext, useEffect, useState } from "react";
import { AuthContext } from "../../context/AuthContext";
import "./ManageUsers.css";

const ManageUsers = () => {
  const { getUsers, deleteUser, user } = useContext(AuthContext);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const data = await getUsers();
        setUsers(data);
      } catch (err) {
        setError("Failed to fetch users");
      }
    };
    fetchUsers();
  }, [getUsers]);

  const handleDelete = async (email) => {
    try {
      const result = await deleteUser(email);
      if (result.success) {
        setUsers(users.filter(u => u.email !== email));
        setError("");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete user");
    }
  };

  return (
    <div className="manage-users">
      <h2>Manage Users</h2>
      {error && <p className="error">{error}</p>}
      {users.length === 0 ? (
        <p>No users found.</p>
      ) : (
        <div className="user-list">
          {users.map((u) => (
            <div key={u.email} className="user-item">
              <p><strong>Name:</strong> {u.name}</p>
              <p><strong>Email:</strong> {u.email}</p>
              <p><strong>Role:</strong> {u.role}</p>
              <button
                className="delete-btn"
                onClick={() => handleDelete(u.email)}
                disabled={user && user.email === u.email}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ManageUsers;