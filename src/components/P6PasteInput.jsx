import React, { useState, useRef } from 'react';
import { BRAND_COLORS } from '../constants';
import { getP6FormatExample, isP6Format } from '../lib/p6Parser';

const P6PasteInput = ({ 
  onDataPasted = null,
  disabled = false,
  placeholder = "Paste your P6 WBS data here...",
  title = "Paste P6 WBS Data",
  description = "Copy WBS Code and WBS Name columns from P6 and paste them here"
}) => {
  const [pasteContent, setPasteContent] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle' | 'validating' | 'success' | 'error'
  const [error, setError] = useState(null);
  const [showExample, setShowExample] = useState(false);
  const textAreaRef = useRef(null);

  // Handle paste content change
  const handleContentChange = (e) => {
    const content = e.target.value;
    setPasteContent(content);
    
    // Clear previous error
    if (error) {
      setError(null);
      setStatus('idle');
    }
    
    // Quick format validation if content exists
    if (content.trim()) {
      if (isP6Format(content)) {
        setStatus('success');
      } else {
        setStatus('error');
        setError('Content does not match expected P6 format');
      }
    } else {
      setStatus('idle');
    }
  };

  // Handle paste processing
  const handleProcessPaste = () => {
    if (!pasteContent.trim()) {
      setError('Please paste P6 WBS data first');
      setStatus('error');
      return;
    }

    try {
      setStatus('validating');
      setError(null);
      
      // Basic validation
      if (!isP6Format(pasteContent)) {
        throw new Error('Invalid P6 format. Please check the format example.');
      }
      
      setStatus('success');
      
      // Call parent callback with the pasted data
      if (onDataPasted) {
        onDataPasted(pasteContent);
      }
      
    } catch (err) {
      setStatus('error');
      setError(err.message);
    }
  };

  // Clear all content
  const handleClear = () => {
    setPasteContent('');
    setStatus('idle');
    setError(null);
    if (textAreaRef.current) {
      textAreaRef.current.focus();
    }
  };

  // Get status styles
  const getStatusStyles = () => {
    switch (status) {
      case 'success':
        return {
          borderColor: '#22c55e',
          backgroundColor: '#f0fdf4'
        };
      case 'error':
        return {
          borderColor: '#ef4444',
          backgroundColor: '#fef2f2'
        };
      case 'validating':
        return {
          borderColor: BRAND_COLORS.accent,
          backgroundColor: `${BRAND_COLORS.level1}20`
        };
      default:
        return {
          borderColor: BRAND_COLORS.level3,
          backgroundColor: BRAND_COLORS.background
        };
    }
  };

  const statusStyles = getStatusStyles();

  return (
    <div style={{ width: '100%', marginBottom: '24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ 
          fontSize: '18px', 
          fontWeight: '600', 
          margin: '0 0 8px 0',
          color: BRAND_COLORS.text 
        }}>
          {title}
        </h3>
        <p style={{ 
          fontSize: '14px', 
          color: BRAND_COLORS.text, 
          opacity: 0.7,
          margin: '0'
        }}>
          {description}
        </p>
      </div>

      {/* Instructions */}
      <div style={{
        backgroundColor: `${BRAND_COLORS.level1}30`,
        border: `1px solid ${BRAND_COLORS.level2}`,
        borderRadius: '8px',
        padding: '12px',
        marginBottom: '16px'
      }}>
        <h4 style={{ 
          fontSize: '14px', 
          fontWeight: '600', 
          margin: '0 0 8px 0',
          color: BRAND_COLORS.text 
        }}>
          📋 Copy Instructions:
        </h4>
        <ol style={{ 
          fontSize: '13px', 
          color: BRAND_COLORS.text,
          margin: '0',
          paddingLeft: '16px'
        }}>
          <li>In P6, select your WBS structure</li>
          <li>Copy <strong>only</strong> the "WBS Code" and "WBS Name" columns</li>
          <li><strong>Do NOT</strong> include the "Total Activities" column</li>
          <li>Paste the data into the text area below</li>
        </ol>
        
        <button
          onClick={() => setShowExample(!showExample)}
          style={{
            fontSize: '12px',
            color: BRAND_COLORS.accent,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textDecoration: 'underline',
            marginTop: '8px'
          }}
        >
          {showExample ? 'Hide' : 'Show'} format example
        </button>
      </div>

      {/* Format Example */}
      {showExample && (
        <div style={{
          backgroundColor: BRAND_COLORS.background,
          border: `1px solid ${BRAND_COLORS.level2}`,
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '16px',
          fontFamily: 'monospace',
          fontSize: '12px'
        }}>
          <pre style={{ 
            margin: '0', 
            whiteSpace: 'pre-wrap',
            color: BRAND_COLORS.text 
          }}>
            {getP6FormatExample()}
          </pre>
        </div>
      )}

      {/* Text Area */}
      <div style={{ position: 'relative' }}>
        <textarea
          ref={textAreaRef}
          value={pasteContent}
          onChange={handleContentChange}
          placeholder={placeholder}
          disabled={disabled}
          style={{
            width: '100%',
            minHeight: '200px',
            padding: '16px',
            border: `2px solid ${statusStyles.borderColor}`,
            borderRadius: '8px',
            backgroundColor: statusStyles.backgroundColor,
            fontFamily: 'monospace',
            fontSize: '13px',
            color: BRAND_COLORS.text,
            resize: 'vertical',
            transition: 'all 0.3s ease',
            outline: 'none'
          }}
          onFocus={(e) => {
            if (status === 'idle') {
              e.target.style.borderColor = BRAND_COLORS.accent;
            }
          }}
          onBlur={(e) => {
            if (status === 'idle') {
              e.target.style.borderColor = BRAND_COLORS.level3;
            }
          }}
        />

        {/* Character count */}
        <div style={{
          position: 'absolute',
          bottom: '8px',
          right: '12px',
          fontSize: '11px',
          color: BRAND_COLORS.text,
          opacity: 0.5,
          pointerEvents: 'none'
        }}>
          {pasteContent.length} characters
        </div>
      </div>

      {/* Status and Actions */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '12px'
      }}>
        {/* Status indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {status === 'success' && (
            <span style={{ 
              color: '#22c55e', 
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              ✅ Valid P6 format detected
            </span>
          )}
          {status === 'error' && error && (
            <span style={{ 
              color: '#ef4444', 
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              ❌ {error}
            </span>
          )}
          {status === 'validating' && (
            <span style={{ 
              color: BRAND_COLORS.accent, 
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              🔄 Validating...
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {pasteContent.trim() && (
            <button
              onClick={handleClear}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                border: `1px solid ${BRAND_COLORS.level3}`,
                borderRadius: '6px',
                backgroundColor: BRAND_COLORS.background,
                color: BRAND_COLORS.text,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => {
                e.target.style.backgroundColor = `${BRAND_COLORS.level1}50`;
              }}
              onMouseOut={(e) => {
                e.target.style.backgroundColor = BRAND_COLORS.background;
              }}
            >
              Clear
            </button>
          )}
          
          <button
            onClick={handleProcessPaste}
            disabled={!pasteContent.trim() || disabled || status === 'validating'}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: (!pasteContent.trim() || disabled) ? '#94a3b8' : BRAND_COLORS.level4,
              color: BRAND_COLORS.white,
              cursor: (!pasteContent.trim() || disabled) ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              if (pasteContent.trim() && !disabled) {
                e.target.style.backgroundColor = BRAND_COLORS.accent;
              }
            }}
            onMouseOut={(e) => {
              if (pasteContent.trim() && !disabled) {
                e.target.style.backgroundColor = BRAND_COLORS.level4;
              }
            }}
          >
            {status === 'validating' ? 'Processing...' : 'Process Data'}
          </button>
        </div>
      </div>

      {/* Data preview for successful parsing */}
      {status === 'success' && pasteContent.trim() && (
        <div style={{
          marginTop: '16px',
          padding: '12px',
          backgroundColor: `${BRAND_COLORS.level1}20`,
          border: `1px solid ${BRAND_COLORS.level2}`,
          borderRadius: '8px'
        }}>
          <h4 style={{ 
            fontSize: '14px', 
            fontWeight: '600', 
            margin: '0 0 8px 0',
            color: BRAND_COLORS.text 
          }}>
            📊 Data Preview:
          </h4>
          <div style={{ 
            fontSize: '13px', 
            color: BRAND_COLORS.text,
            opacity: 0.8
          }}>
            {(() => {
              const lines = pasteContent.split('\n').filter(line => line.trim());
              const dataLines = lines.slice(1); // Skip header
              return `${dataLines.length} WBS items detected`;
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default P6PasteInput;
