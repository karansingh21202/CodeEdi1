import React from 'react';
import './Sidebar.css';

function Sidebar() {
  return (
    <div className="sidebar">
      <h3>CodeAnt AI</h3>
      <ul>
        <li>Repositories</li>
        <li>Settings</li>
        <li>Support</li>
        <li>Logout</li>
      </ul>
    </div>
  );
}

export default Sidebar;
