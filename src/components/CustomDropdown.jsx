import { createPortal } from 'react-dom';
import { useRef, useEffect, useState } from 'react';

export default function CustomDropdown({ label, value, options, onChange, isOpen, onToggle }) {
    const isActive = value !== '';
    const triggerRef = useRef(null);
    const dropdownRef = useRef(null);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

    useEffect(() => {
        if (isOpen && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setDropdownPosition({
                top: rect.bottom + window.scrollY + 8,
                left: rect.left + window.scrollX,
                width: rect.width
            });
        }
    }, [isOpen]);

    // Close dropdown when clicking outside
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event) => {
            // Usa setTimeout per permettere all'onClick dell'opzione di eseguirsi prima
            setTimeout(() => {
                if (
                    triggerRef.current && !triggerRef.current.contains(event.target) &&
                    dropdownRef.current && !dropdownRef.current.contains(event.target)
                ) {
                    onToggle();
                }
            }, 0);
        };

        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [isOpen, onToggle]);

    return (
        <>
            <div className={`custom-dropdown ${isOpen ? 'open' : ''}`} style={{ position: 'relative' }}>
                <label className="form-label text-light" style={{ fontSize: '0.95rem', fontWeight: 600 }}>
                    {label}
                </label>
                <div
                    ref={triggerRef}
                    className={`custom-dropdown-trigger ${isActive ? 'filter-active' : ''}`}
                    onClick={onToggle}
                    style={{
                        background: isActive
                            ? 'linear-gradient(135deg, rgba(255, 209, 102, 0.15) 0%, rgba(155, 126, 255, 0.12) 100%)'
                            : 'linear-gradient(135deg, rgba(155, 126, 255, 0.08) 0%, rgba(107, 159, 255, 0.05) 100%)',
                        border: `1.5px solid ${isActive ? 'rgba(255, 209, 102, 0.5)' : 'rgba(155, 126, 255, 0.25)'}`,
                        borderRadius: '10px',
                        padding: '0.75rem 1rem',
                        cursor: 'pointer',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        position: 'relative',
                        userSelect: 'none',
                        boxShadow: isActive
                            ? '0 4px 16px rgba(255, 209, 102, 0.2)'
                            : '0 2px 8px rgba(155, 126, 255, 0.1)',
                        fontWeight: isActive ? 600 : 500
                    }}
                    onMouseEnter={(e) => {
                        if (!isActive) {
                            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(155, 126, 255, 0.12) 0%, rgba(107, 159, 255, 0.08) 100%)';
                            e.currentTarget.style.borderColor = 'rgba(155, 126, 255, 0.4)';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(155, 126, 255, 0.15)';
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (!isActive) {
                            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(155, 126, 255, 0.08) 0%, rgba(107, 159, 255, 0.05) 100%)';
                            e.currentTarget.style.borderColor = 'rgba(155, 126, 255, 0.25)';
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(155, 126, 255, 0.1)';
                        }
                    }}
                >
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        color: '#fff',
                        fontSize: '0.95rem'
                    }}>
                        <span>{value ? options.find(opt => opt.value === value)?.label : options[0].label}</span>
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            style={{
                                transition: 'transform 0.3s ease',
                                transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)'
                            }}
                        >
                            <path fill={isActive ? '#FFD166' : '#9B7EFF'} d="M8 11L3 6h10z" />
                        </svg>
                    </div>
                </div>
            </div>

            {isOpen && createPortal(
                <div ref={dropdownRef} className="custom-dropdown-menu" style={{
                    position: 'absolute',
                    top: `${dropdownPosition.top}px`,
                    left: `${dropdownPosition.left}px`,
                    width: `${dropdownPosition.width}px`,
                    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                    border: '1.5px solid rgba(155, 126, 255, 0.3)',
                    borderRadius: '10px',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(155, 126, 255, 0.2)',
                    zIndex: 99999,
                    maxHeight: '300px',
                    overflowY: 'auto',
                    animation: 'slideDown 0.2s ease-out'
                }}>
                    {options.map((option, index) => (
                        <div
                            key={option.value}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                console.log('Dropdown clicked:', option.value);
                                onChange(option.value);
                                console.log('onChange called');
                                setTimeout(() => onToggle(), 100); // Chiude il dropdown dopo la selezione
                            }}
                            style={{
                                padding: '0.75rem 1rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                color: value === option.value ? '#FFD166' : '#fff',
                                fontWeight: value === option.value ? 600 : 500,
                                background: value === option.value
                                    ? 'linear-gradient(135deg, rgba(255, 209, 102, 0.15) 0%, rgba(155, 126, 255, 0.1) 100%)'
                                    : 'transparent',
                                borderTop: index > 0 ? '1px solid rgba(255, 255, 255, 0.05)' : 'none'
                            }}
                            onMouseEnter={(e) => {
                                if (value !== option.value) {
                                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(155, 126, 255, 0.15) 0%, rgba(107, 159, 255, 0.1) 100%)';
                                    e.currentTarget.style.color = '#9B7EFF';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (value !== option.value) {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = '#fff';
                                }
                            }}
                        >
                            {option.label}
                        </div>
                    ))}
                </div>,
                document.body
            )}
        </>
    );
}
