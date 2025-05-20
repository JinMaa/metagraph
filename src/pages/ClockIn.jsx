import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';

/**
 * ClockIn Page Component
 *
 * A simple page with a centered button for clocking in
 */
const ClockIn = () => {
  const { endpoint = 'mainnet' } = useOutletContext() || {};
  const [clockedIn, setClockedIn] = useState(false);
  const [timestamp, setTimestamp] = useState(null);

  const handleClockIn = () => {
    const now = new Date();
    setTimestamp(now);
    setClockedIn(true);
    
    // You could add actual API call here to record the clock-in
    console.log('User clocked in at:', now);
  };

  return (
    <div role="region" aria-labelledby="clock-in-title">
      <h2 id="clock-in-title">Clock In</h2>
      <p>Use the button below to clock in for your session.</p>

      {/* Main content with centered button */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: '40px',
        marginBottom: '40px'
      }}>
        <fieldset className="group-box" style={{ width: '300px', textAlign: 'center' }}>
          <legend>Time Tracking</legend>
          
          {!clockedIn ? (
            <button 
              onClick={handleClockIn}
              style={{ 
                padding: '15px 30px',
                fontSize: '16px',
                margin: '20px auto'
              }}
              aria-label="Clock in now"
            >
              Clock In
            </button>
          ) : (
            <div>
              <p style={{ color: 'green', fontWeight: 'bold' }}>
                ✓ Clocked in successfully
              </p>
              <p>
                {timestamp.toLocaleString()}
              </p>
              <button 
                onClick={() => setClockedIn(false)}
                style={{ marginTop: '10px' }}
              >
                Reset
              </button>
            </div>
          )}
        </fieldset>
      </div>
    </div>
  );
};

export default ClockIn;
