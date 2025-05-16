import React, { useContext, useEffect } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import './WalletPage.css';

const WalletPage = () => {
  const { user, wallet, fetchWallet } = useContext(AuthContext);

  useEffect(() => {
    if (user && user.id) {
      const token = localStorage.getItem('token');
      fetchWallet(token, user.id).catch((err) => {
        console.error('Failed to fetch wallet:', err);
        toast.error('Failed to load wallet data');
      });
    }
  }, [user, fetchWallet]);

  return (
    <div className="wallet-page">
      <h2>💸 My Wallet</h2>
      <div className="wallet-card">
        <h3>Wallet Balance</h3>
        <p className="wallet-balance">₹{wallet.balance.toFixed(2)}</p>
      </div>
      <div className="wallet-transactions">
        <h3>Transaction History</h3>
        {wallet.transactions.length === 0 ? (
          <p>No transactions found.</p>
        ) : (
          <div className="transactions-table-container">
            <table className="transactions-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Type</th>
                  <th>Reason</th>
                  <th>Order ID</th>
                </tr>
              </thead>
              <tbody>
                {wallet.transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td>{new Date(tx.created_at).toLocaleString()}</td>
                    <td className={tx.type === 'credit' ? 'credit' : 'debit'}>
                      {tx.type === 'credit' ? '+' : '-'}₹{Math.abs(tx.amount).toFixed(2)}
                    </td>
                    <td>{tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}</td>
                    <td>{tx.reason}</td>
                    <td>{tx.order_id || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default WalletPage;