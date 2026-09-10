import { useState } from 'react';
import { addDoc, collection, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useCollection } from '../../hooks/useFirestore';
import { Plus, X, Loader2, Copy } from 'lucide-react';

export function BulkLabCreator() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  
  // Shared fields
  const [labNumber, setLabNumber] = useState('');
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [venue, setVenue] = useState('');
  
  // Groups data
  const { data: groups, loading: groupsLoading } = useCollection('groups');
  
  // Per-group state
  const [selectedGroups, setSelectedGroups] = useState({});
  const [groupDates, setGroupDates] = useState({});

  // Initialize group selections when groups load without using an effect
  if (groups && groups.length > 0 && Object.keys(selectedGroups).length === 0) {
    const initialSelected = {};
    const initialDates = {};
    groups.forEach(g => {
      initialSelected[g.id] = true;
      initialDates[g.id] = '';
    });
    setSelectedGroups(initialSelected);
    setGroupDates(initialDates);
  }

  const checkedCount = Object.values(selectedGroups).filter(Boolean).length;
  
  const handleOpen = () => setIsOpen(true);
  
  const handleClose = () => {
    setIsOpen(false);
    setMessage('');
  };
  
  const handleCreate = async () => {
    // Validation
    if (!labNumber || !title || !startTime || !endTime || !venue) {
      setMessage('Please fill in all required fields.');
      return;
    }
    
    const checkedGroups = groups.filter(g => selectedGroups[g.id]);
    
    if (checkedGroups.length === 0) {
      setMessage('Please select at least one group.');
      return;
    }
    
    for (const group of checkedGroups) {
      if (!groupDates[group.id]) {
        setMessage(`Please select a date for group ${group.name}.`);
        return;
      }
    }
    
    setIsSaving(true);
    setMessage('');
    
    try {
      const promises = checkedGroups.map(group => {
        const payload = {
          labNumber: Number(labNumber),
          title: title,
          topic: topic,
          date: groupDates[group.id],
          startTime: startTime,
          endTime: endTime,
          venue: venue,
          status: 'scheduled',
          groupIds: [doc(db, 'groups', group.id)],
          createdAt: serverTimestamp(),
        };
        return addDoc(collection(db, 'labSessions'), payload);
      });
      
      await Promise.all(promises);
      
      setMessage('Success! Lab sessions created.');
      
      // Reset fields
      setLabNumber('');
      setTitle('');
      setTopic('');
      setStartTime('');
      setEndTime('');
      setVenue('');
      
      const resetSelected = {};
      const resetDates = {};
      groups.forEach(g => {
        resetSelected[g.id] = true;
        resetDates[g.id] = '';
      });
      setSelectedGroups(resetSelected);
      setGroupDates(resetDates);
      
      setTimeout(() => {
        setMessage('');
        setIsOpen(false);
      }, 3000);
      
    } catch (error) {
      console.error('Error creating labs:', error);
      setMessage('Error creating lab sessions. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        <Copy className="w-4 h-4" />
        Bulk Create Labs
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-slate-800">Bulk Create Lab Sessions</h2>
              <button onClick={handleClose} className="text-slate-500 hover:text-slate-700 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {message && (
              <div className={`p-3 rounded-lg mb-4 text-sm font-medium ${message.includes('Success') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {message}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Lab Number *</label>
                <input
                  type="number"
                  min="1"
                  max="11"
                  value={labNumber}
                  onChange={(e) => setLabNumber(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. 1"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Lab 04 — Digital Logic"
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Topic</label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional topic description"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Start Time *</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">End Time *</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Venue *</label>
                <input
                  type="text"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Computer Lab 1"
                />
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-sm font-semibold text-slate-800 mb-3 border-b pb-2">Group Assignments</h3>
              
              {groupsLoading ? (
                <div className="flex justify-center py-4 text-slate-500">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : groups && groups.length > 0 ? (
                <div className="space-y-3">
                  {groups.map(group => (
                    <div key={group.id} className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={!!selectedGroups[group.id]}
                          onChange={(e) => setSelectedGroups(prev => ({ ...prev, [group.id]: e.target.checked }))}
                          className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-slate-700">{group.name}</span>
                      </div>
                      
                      <div className="w-40">
                        <input
                          type="date"
                          value={groupDates[group.id] || ''}
                          onChange={(e) => setGroupDates(prev => ({ ...prev, [group.id]: e.target.value }))}
                          disabled={!selectedGroups[group.id]}
                          className="w-full border border-slate-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-slate-100"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-500 py-2">No groups found.</div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                onClick={handleClose}
                disabled={isSaving}
                className="text-slate-500 hover:text-slate-700 text-sm font-medium px-4 py-2"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={isSaving || checkedCount === 0}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Create {checkedCount} {checkedCount === 1 ? 'Session' : 'Sessions'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
