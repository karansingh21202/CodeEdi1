import React from 'react';
import './LoginScreen.css';

function LoginScreen() {
  return (
    <div className="login-container">
      <h1>Welcome to CodeAnt AI</h1>
      <div className="login-buttons">
        <button>Sign in with GitHub</button>
        <button>Sign in with Bitbucket</button>
        <button>Sign in with Azure DevOps</button>
        <button>Sign in with Google</button>
      </div>
    </div>
  );
}

export default LoginScreen;
