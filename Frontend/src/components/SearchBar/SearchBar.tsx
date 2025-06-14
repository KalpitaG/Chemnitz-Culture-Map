// components/Search/SearchBar.tsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { apiService } from '../../services/api';
import { CategoryType } from '../../types';
import './SearchBar.css';

interface SearchSuggestion {
  id: string;
  name: string;
  category: string;
  address?: string;
}

interface SearchBarProps {
  onSearch: (query: string) => void;
  onSuggestionSelect: (suggestion: SearchSuggestion) => void;
  onClearSearch: () => void;
  isSearching?: boolean;
  placeholder?: string;
  currentQuery?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  onSuggestionSelect,
  onClearSearch,
  isSearching = false,
  placeholder = "Search cultural sites...",
  currentQuery = ""
}) => {
  const [query, setQuery] = useState(currentQuery);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceTimeoutRef = useRef<number | null>(null);

  // Get category icon for suggestions
  const getCategoryIcon = (category: string): string => {
    switch (category.toLowerCase()) {
      case CategoryType.THEATRE: return '🎭';
      case CategoryType.MUSEUM: return '🏛️';
      case CategoryType.RESTAURANT: return '🍽️';
      case CategoryType.ARTWORK: return '🎨';
      default: return '📍';
    }
  };

  // Debounced autocomplete search
  const fetchSuggestions = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoadingSuggestions(true);
    
    try {
      const response = await apiService.autocompleteSearch(searchQuery, 8);
      setSuggestions(response.suggestions);
      setShowSuggestions(response.suggestions.length > 0);
      setSelectedIndex(-1);
    } catch (error) {
      console.error('Autocomplete error:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, []);

  // Handle input change with debouncing
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Always fetch suggestions for autocomplete (but don't trigger search)
    if (value.trim().length >= 2) {
      debounceTimeoutRef.current = window.setTimeout(() => {
        fetchSuggestions(value.trim());
      }, 300); // Fast for autocomplete
    } else if (value.trim().length === 0) {
      // Clear everything if input is empty
      onClearSearch();
      setSuggestions([]);
      setShowSuggestions(false);
    } else {
      // For 1 character, just clear suggestions
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [onClearSearch, fetchSuggestions]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Enter' && query.trim() && query.trim().length >= 2) {
        // Only trigger search on Enter press
        onSearch(query.trim());
        setShowSuggestions(false);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSuggestionClick(suggestions[selectedIndex]);
        } else if (query.trim() && query.trim().length >= 2) {
          onSearch(query.trim());
          setShowSuggestions(false);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  }, [showSuggestions, suggestions, selectedIndex, query, onSearch]);

  // Handle suggestion click
  const handleSuggestionClick = useCallback((suggestion: SearchSuggestion) => {
    setQuery(suggestion.name);
    onSuggestionSelect(suggestion);
    setShowSuggestions(false);
    setSelectedIndex(-1);
  }, [onSuggestionSelect]);

  // Handle clear button
  const handleClear = useCallback(() => {
    setQuery('');
    onClearSearch();
    setSuggestions([]);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  }, [onClearSearch]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync with external query changes
  useEffect(() => {
    if (currentQuery !== query) {
      setQuery(currentQuery);
    }
  }, [currentQuery]);

  return (
    <div className="search-bar-container">
      <div className="search-input-wrapper">
        <div className="search-input-container">
          <i className="fas fa-search search-icon"></i>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (suggestions.length > 0) {
                setShowSuggestions(true);
              }
            }}
            placeholder={placeholder}
            className="search-input"
            disabled={isSearching}
          />
          
          {/* Loading spinner */}
          {(isSearching || isLoadingSuggestions) && (
            <div className="search-loading">
              <i className="fas fa-spinner search-spinner"></i>
            </div>
          )}
          
          {/* Clear button */}
          {query && !isSearching && (
            <button
              onClick={handleClear}
              className="search-clear-btn"
              type="button"
            >
              <i className="fas fa-times"></i>
            </button>
          )}
        </div>

        {/* Search suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div ref={suggestionsRef} className="search-suggestions">
            <div className="suggestions-header">
              <i className="fas fa-lightbulb suggestions-icon"></i>
              <span className="suggestions-title">Suggestions</span>
            </div>
            
            <div className="suggestions-list">
              {suggestions.map((suggestion, index) => (
                <div
                  key={suggestion.id}
                  className={`suggestion-item ${index === selectedIndex ? 'selected' : ''}`}
                  onClick={() => handleSuggestionClick(suggestion)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="suggestion-icon">
                    {getCategoryIcon(suggestion.category)}
                  </div>
                  <div className="suggestion-content">
                    <div className="suggestion-name">{suggestion.name}</div>
                    <div className="suggestion-details">
                      <span className="suggestion-category">
                        {suggestion.category.charAt(0).toUpperCase() + suggestion.category.slice(1)}
                      </span>
                      {suggestion.address && (
                        <>
                          <span className="suggestion-separator">•</span>
                          <span className="suggestion-address">{suggestion.address}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Search status - REMOVED: Don't show automatic search status */}
      {/* We only show search results in the main app, not here */}
    </div>
  );
};

export default SearchBar;