import React, { useState, useEffect } from 'react';
import { Clock, Download, Trash2, Loader } from 'lucide-react';
import { supabase } from '../supabase/config';

const HistoryPage = ({ userId }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, [userId]);

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('enhancements')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, imageUrl) => {
    if (!confirm('Delete this image?')) return;
    
    try {
      // Delete from database
      const { error: dbError } = await supabase
        .from('enhancements')
        .delete()
        .eq('id', id);
      
      if (dbError) throw dbError;
      
      // Delete from storage (optional - extract filename from URL)
      const fileName = imageUrl.split('/').pop();
      await supabase.storage
        .from('enhanced-images')
        .remove([`${userId}/${fileName}`]);
      
      setHistory(history.filter(item => item.id !== id));
    } catch (error) {
      console.error('Error deleting:', error);
      alert('Failed to delete');
    }
  };

  const handleDownload = (url, id) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `lumin-x-${id}.png`;
    link.target = '_blank';
    link.click();
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <Loader className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">Processing History</h2>
          <p className="text-slate-400">View all your enhanced images</p>
        </div>

        {history.length === 0 ? (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-12 text-center">
            <Clock className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-400 mb-2">No History Yet</h3>
            <p className="text-slate-500">Start enhancing images to see your history here</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {history.map((item) => (
              <div key={item.id} className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                <div className="p-2 bg-slate-900">
                  <img 
                    src={item.enhanced_image_url} 
                    alt="Enhanced" 
                    className="w-full h-48 object-cover rounded"
                  />
                </div>
                
                <div className="p-4">
                  <div className="flex items-center gap-2 text-sm text-slate-400 mb-3">
                    <Clock className="w-4 h-4" />
                    <span>{new Date(item.created_at).toLocaleString()}</span>
                  </div>
                  
                  <div className="mb-3">
                    <div className="text-sm font-medium text-white mb-1">Algorithm</div>
                    <div className="text-sm text-blue-400">{item.algorithm}</div>
                  </div>
                  
                  <div className="mb-3">
                    <div className="text-sm font-medium text-white mb-1">Parameters</div>
                    <div className="text-xs text-slate-400 space-y-1">
                      <div>Brightness: {item.parameters?.brightness?.toFixed(2)}</div>
                      <div>Contrast: {item.parameters?.contrast?.toFixed(2)}</div>
                      <div>Saturation: {item.parameters?.saturation?.toFixed(2)}</div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleDownload(item.enhanced_image_url, item.id)}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                    <button 
                      onClick={() => handleDelete(item.id, item.enhanced_image_url)}
                      className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryPage;
