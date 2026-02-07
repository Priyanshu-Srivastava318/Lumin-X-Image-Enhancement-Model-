import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Image, Clock, Loader, RefreshCw } from 'lucide-react';
import { supabase } from '../supabase/config';

const AnalyticsPage = ({ userId }) => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
    
    // Real-time subscription
    const channel = supabase
      .channel('analytics-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'enhancements', filter: `user_id=eq.${userId}` },
        () => {
          fetchAnalytics();
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const fetchAnalytics = async () => {
    try {
      const { data, error } = await supabase
        .from('enhancements')
        .select('*')
        .eq('user_id', userId);
      
      if (error) throw error;
      
      const items = data || [];
      const totalProcessed = items.length;
      const algorithmCounts = {};
      let totalBrightness = 0;
      let totalContrast = 0;
      
      items.forEach(item => {
        algorithmCounts[item.algorithm] = (algorithmCounts[item.algorithm] || 0) + 1;
        totalBrightness += item.parameters?.brightness || 0;
        totalContrast += item.parameters?.contrast || 0;
      });
      
      setAnalytics({
        totalProcessed,
        algorithmCounts,
        avgBrightness: totalProcessed > 0 ? (totalBrightness / totalProcessed).toFixed(2) : '0.00',
        avgContrast: totalProcessed > 0 ? (totalContrast / totalProcessed).toFixed(2) : '0.00',
        mostUsedAlgorithm: Object.entries(algorithmCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <Loader className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  const { totalProcessed, algorithmCounts, avgBrightness, avgContrast, mostUsedAlgorithm } = analytics || {};

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Analytics Dashboard</h2>
            <p className="text-slate-400">Insights and statistics</p>
          </div>
          <button
            onClick={() => {
              setLoading(true);
              fetchAnalytics();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <div className="text-slate-400 text-sm">Total Processed</div>
              <Image className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-3xl font-bold text-white">{totalProcessed || 0}</div>
            <div className="text-xs text-slate-500 mt-1">Images enhanced</div>
          </div>

          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <div className="text-slate-400 text-sm">Avg Brightness</div>
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            <div className="text-3xl font-bold text-white">{avgBrightness}</div>
            <div className="text-xs text-slate-500 mt-1">Average value</div>
          </div>

          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <div className="text-slate-400 text-sm">Avg Contrast</div>
              <BarChart3 className="w-5 h-5 text-purple-400" />
            </div>
            <div className="text-3xl font-bold text-white">{avgContrast}</div>
            <div className="text-xs text-slate-500 mt-1">Average value</div>
          </div>

          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <div className="text-slate-400 text-sm">Most Used</div>
              <Clock className="w-5 h-5 text-yellow-400" />
            </div>
            <div className="text-lg font-bold text-white truncate">{mostUsedAlgorithm}</div>
            <div className="text-xs text-slate-500 mt-1">Algorithm</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              Algorithm Usage
            </h3>
            
            {!algorithmCounts || Object.keys(algorithmCounts).length === 0 ? (
              <div className="text-center py-8 text-slate-500">No data yet</div>
            ) : (
              <div className="space-y-4">
                {Object.entries(algorithmCounts).map(([algo, count]) => {
                  const percentage = (count / totalProcessed * 100).toFixed(1);
                  return (
                    <div key={algo}>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm text-slate-300">{algo}</span>
                        <span className="text-sm text-blue-400">{count} ({percentage}%)</span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              Summary
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-700 rounded-lg">
                <div>
                  <div className="text-sm text-slate-400">Total Enhancements</div>
                  <div className="text-2xl font-semibold text-white mt-1">{totalProcessed || 0}</div>
                </div>
                <Image className="w-8 h-8 text-blue-400" />
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-700 rounded-lg">
                <div>
                  <div className="text-sm text-slate-400">Favorite Algorithm</div>
                  <div className="text-sm font-medium text-white mt-1">{mostUsedAlgorithm}</div>
                </div>
                <BarChart3 className="w-8 h-8 text-purple-400" />
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-700 rounded-lg">
                <div>
                  <div className="text-sm text-slate-400">Success Rate</div>
                  <div className="text-lg font-semibold text-green-400 mt-1">100%</div>
                </div>
                <TrendingUp className="w-8 h-8 text-green-400" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;