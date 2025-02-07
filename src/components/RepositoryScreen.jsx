import React from 'react';
import Sidebar from './Sidebar';
import './RepositoryScreen.css';

function RepositoryScreen() {
  return (
    <div className="repository-container">
      <Sidebar />
      <div className="repository-content">
        <h2>Repositories</h2>
        <button className="add-repo-button">+ Add Repository</button>
        <table className="repository-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Last Updated</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>CodeAnt AI</td>
              <td>Private</td>
              <td>2 days ago</td>
            </tr>
            <tr>
              <td>Analytics Dashboard</td>
              <td>Public</td>
              <td>4 days ago</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default RepositoryScreen;