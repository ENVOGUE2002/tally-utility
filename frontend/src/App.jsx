import { useState, useEffect } from 'react'
import './App.css'

export default function App() {
    const [backendStatus, setBackendStatus] = useState('Checking...')
    useEffect(() => {
        fetch('http://localhost:5000/api/health')
            .then(res => res.json())
            .then(data => setBackendStatus('✅ Connected'))
            .catch(() => setBackendStatus('❌ Not Connected'))
    }, [])

    return (
        <div className="app">
            <h1>🎉 Tally Utility</h1>
            <p>Transaction Management System</p>
            <div className="dashboard">
                <div className="card">
                    <h2>💰 Sales</h2>
                    <button>Manage Sales</button>
                </div>
                <div className="card">
                    <h2>📦 Purchases</h2>
                    <button>Manage Purchases</button>
                </div>
                <div className="card">
                    <h2>📝 Vouchers</h2>
                    <button>Manage Vouchers</button>
                </div>
                <div className="card">
                    <h2>🏦 Bank</h2>
                    <button>Bank Entries</button>
                </div>
            </div>
            <div className="status">
                <p>Backend Status: <strong>{backendStatus}</strong></p>
            </div>
        </div>
    )
}