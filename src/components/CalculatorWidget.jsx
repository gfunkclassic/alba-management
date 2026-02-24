// src/components/CalculatorWidget.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Calculator as CalculatorIcon, X } from 'lucide-react';

export default function CalculatorWidget({ onClose }) {
    const [input, setInput] = useState('');
    const [result, setResult] = useState('');

    const handleClick = useCallback((value) => {
        if (value === '=') {
            try {
                const calc = new Function('return ' + input.replace(/x/g, '*').replace(/÷/g, '/'))();
                setResult(String(calc));
            } catch (e) {
                setResult('Error');
            }
        }
        else if (value === 'C') { setInput(''); setResult(''); }
        else if (value === 'DEL') { setInput(prev => prev.slice(0, -1)); }
        else { setInput(prev => prev + value); }
    }, [input]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            const key = e.key;
            if ((key >= '0' && key <= '9') || key === '.') handleClick(key);
            else if (key === '+') handleClick('+');
            else if (key === '-') handleClick('-');
            else if (key === '*' || key.toLowerCase() === 'x') handleClick('x');
            else if (key === '/') handleClick('÷');
            else if (key === 'Enter' || key === '=') { e.preventDefault(); handleClick('='); }
            else if (key === 'Backspace') handleClick('DEL');
            else if (key === 'Escape' || key.toLowerCase() === 'c') handleClick('C');
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleClick]);

    const buttons = ['C', '÷', 'x', 'DEL', '7', '8', '9', '-', '4', '5', '6', '+', '1', '2', '3', '=', '0', '.'];

    return (
        <div className="fixed bottom-4 right-4 w-72 bg-[#4a4535] shadow-2xl border-2 border-[#3d472f] z-[100] flex flex-col rounded-none">
            <div className="bg-[#3d472f] p-3 flex justify-between items-center border-b-2 border-[#2d3721]">
                <h4 className="text-[#f5f3e8] text-xs font-bold flex items-center gap-2"><CalculatorIcon size={14} /> 계산기</h4>
                <button onClick={onClose} className="text-[#b8c4a0] hover:text-[#f5f3e8]"><X size={16} /></button>
            </div>
            <div className="p-4 bg-[#4a4535]">
                <div className="bg-[#f5f3e8] p-3 mb-3 text-right h-20 flex flex-col justify-center border-2 border-[#3d472f]">
                    <div className="text-[#7a7565] text-xs h-4 font-mono">{input}</div>
                    <div className="text-[#3d472f] text-2xl font-black truncate font-mono">{result || (input || '0')}</div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                    {buttons.map((btn, i) => (
                        <button key={i} onClick={() => handleClick(btn)} className={`h-10 text-sm font-bold transition rounded-none ${btn === '=' ? 'row-span-2 h-full bg-[#5d6c4a] hover:bg-[#6b7b54] text-[#f5f3e8]' : ''} ${btn === '0' ? 'col-span-2' : ''} ${['C', 'DEL', '÷', 'x', '-', '+'].includes(btn) ? 'bg-[#5a5545] text-[#b8c4a0] hover:bg-[#6a6555]' : 'bg-[#5a5545] text-[#f5f3e8] hover:bg-[#6a6555]'}`}>{btn}</button>
                    ))}
                </div>
            </div>
        </div>
    );
}
