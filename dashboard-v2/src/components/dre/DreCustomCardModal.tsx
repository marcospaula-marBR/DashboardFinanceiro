import React, { useState, useMemo } from 'react';
import { X, Search, CheckSquare, Square, Settings, Eye } from 'lucide-react';

interface DreCustomCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableCategories: string[];
  selectedCategories: string[];
  onSave: (categories: string[]) => void;
}

export function DreCustomCardModal({
  isOpen,
  onClose,
  availableCategories = [],
  selectedCategories = [],
  onSave,
}: DreCustomCardModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [tempSelected, setTempSelected] = useState<string[]>(selectedCategories);

  // Sync state when opening
  React.useEffect(() => {
    if (isOpen) {
      setTempSelected(selectedCategories);
      setSearchTerm('');
    }
  }, [isOpen, selectedCategories]);

  const filteredCategories = useMemo(() => {
    return availableCategories.filter(cat =>
      cat.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [availableCategories, searchTerm]);

  if (!isOpen) return null;

  const toggleCategory = (cat: string) => {
    setTempSelected(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handleSelectAll = () => {
    // If all filtered are already selected, deselect them
    const allSelected = filteredCategories.every(cat => tempSelected.includes(cat));
    if (allSelected) {
      setTempSelected(prev => prev.filter(cat => !filteredCategories.includes(cat)));
    } else {
      setTempSelected(prev => Array.from(new Set([...prev, ...filteredCategories])));
    }
  };

  const handleSave = () => {
    onSave(tempSelected);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
              <Settings size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800">Card Personalizado Livre</h2>
              <p className="text-xs font-medium text-slate-500">
                Selecione as rubricas que deseja consolidar neste card
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search & Actions */}
        <div className="p-6 pb-2 border-b border-slate-100 flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-3 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Pesquisar categoria..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 outline-none transition-colors"
            />
          </div>
          <div className="flex justify-between items-center text-xs">
            <div className="flex gap-4">
              <button
                onClick={handleSelectAll}
                className="font-bold text-indigo-600 hover:text-indigo-700 transition-colors flex items-center gap-1"
              >
                {filteredCategories.every(cat => tempSelected.includes(cat)) ? 'Desmarcar Todos' : 'Selecionar Todos'}
              </button>
              {tempSelected.length > 0 && (
                <button
                  onClick={() => setTempSelected([])}
                  className="font-bold text-rose-600 hover:text-rose-750 transition-colors flex items-center gap-1"
                >
                  Limpar Seleções
                </button>
              )}
            </div>
            <span className="font-semibold text-slate-400">
              {tempSelected.length} selecionadas de {availableCategories.length}
            </span>
          </div>
        </div>

        {/* Categories List */}
        <div className="flex-1 overflow-y-auto p-6 min-h-[250px] custom-scrollbar">
          {filteredCategories.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {filteredCategories.map((cat, index) => {
                const isSelected = tempSelected.includes(cat);
                return (
                  <div
                    key={index}
                    onClick={() => toggleCategory(cat)}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-all duration-150 select-none ${
                      isSelected
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-900 font-semibold'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-650'
                    }`}
                  >
                    <div className={isSelected ? 'text-indigo-600' : 'text-slate-400'}>
                      {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                    </div>
                    <span className="text-xs break-all leading-tight">
                      {cat}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-sm text-slate-450">
              Nenhuma categoria encontrada para "{searchTerm}"
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-250 bg-white text-slate-700 text-sm font-bold hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors"
          >
            Aplicar Configuração
          </button>
        </div>

      </div>
    </div>
  );
}
