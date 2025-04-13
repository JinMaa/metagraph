import React, { useState, useEffect } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

/**
 * TerminalCodeBlock Component
 *
 * A VSCode-like terminal code block with syntax highlighting, copy functionality,
 * and interactive elements that mimic an integrated terminal.
 *
 * @param {Object} props
 * @param {string} props.code - The code to display
 * @param {string} props.language - The language for syntax highlighting (default: 'javascript')
 * @param {string} props.title - Optional title for the terminal window
 * @param {boolean} props.showLineNumbers - Whether to show line numbers (default: false)
 * @param {boolean} props.showPrompt - Whether to show a command prompt (default: false)
 */
const TerminalCodeBlock = ({
  code,
  language = 'javascript',
  title = 'Terminal',
  showLineNumbers = false,
  showPrompt = false
}) => {
  const [copied, setCopied] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  // Reset the copied state after 2 seconds
  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => {
        setCopied(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  // Handle copy to clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
    });
  };

  // MS-DOS style terminal theme
  const customStyle = {
    ...vscDarkPlus,
    'pre[class*="language-"]': {
      backgroundColor: '#000000', // Black background like MS-DOS
      margin: 0,
      padding: '12px',
      overflow: 'auto',
      borderRadius: 0,
      fontFamily: "'Courier New', monospace", // Classic DOS-like font
      fontSize: '14px',
      lineHeight: 1.2,
      color: '#FFFFFF' // White text like MS-DOS
    },
    'code[class*="language-"]': {
      fontFamily: "'Courier New', monospace", // Classic DOS-like font
      fontSize: '14px',
      lineHeight: 1.2,
      backgroundColor: 'transparent',
      color: '#FFFFFF' // White text like MS-DOS
    },
    // Simplified token styling for MS-DOS look
    'token': {
      backgroundColor: 'transparent !important',
      color: '#FFFFFF' // Default white for all tokens
    },
    'keyword': {
      color: '#FFFFFF', // White in MS-DOS
      backgroundColor: 'transparent'
    },
    'string': {
      color: '#FFFFFF', // White in MS-DOS
      backgroundColor: 'transparent'
    },
    'number': {
      color: '#FFFFFF', // White in MS-DOS
      backgroundColor: 'transparent'
    },
    'boolean': {
      color: '#FFFFFF', // White in MS-DOS
      backgroundColor: 'transparent'
    },
    'property': {
      color: '#FFFFFF', // White in MS-DOS
      backgroundColor: 'transparent'
    },
    'operator': {
      color: '#FFFFFF', // White in MS-DOS
      backgroundColor: 'transparent'
    },
    'punctuation': {
      color: '#FFFFFF', // White in MS-DOS
      backgroundColor: 'transparent'
    },
    'comment': {
      color: '#FFFFFF', // White in MS-DOS
      backgroundColor: 'transparent'
    }
  };

  // Process code with prompt if needed
  const processedCode = showPrompt ? `$ ${code}` : code;

  return (
    <div className="window" style={{ width: '100%' }}>
      {/* MS-DOS style title bar */}
      <div className="title-bar">
        <div className="title-bar-text">{title}</div>
        <div className="title-bar-controls">
          <button aria-label="Copy" onClick={handleCopy} title="Copy to clipboard">
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* MS-DOS style terminal content */}
      <div className="window-body" style={{ padding: 0 }}>
        <div className="sunken-panel" style={{ padding: 0, margin: 0 }}>
          <SyntaxHighlighter
            language={language}
            style={customStyle}
            showLineNumbers={showLineNumbers}
            wrapLines={true}
          >
            {processedCode}
          </SyntaxHighlighter>
        </div>
      </div>
    </div>
  );
};

export default TerminalCodeBlock;
