import React, { useState, useEffect, useRef } from 'react';
import { CrewAIService, NaturalLanguageAgentConfig, Workflow } from '../services/crewaiService';
import type { ApiConfig } from '../services/geminiService';
import { createFinancialReportWorkflow } from '../services/crewaiWorkflow';

interface WorkflowSetupProps {
  onWorkflowChange: (workflow: Workflow) => void;
  onClose: () => void;
}

const WorkflowSetup: React.FC<WorkflowSetupProps> = ({ onWorkflowChange, onClose }) => {
  const [naturalLanguageInput, setNaturalLanguageInput] = useState('');
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    // Load default workflow
    const defaultWorkflow = createFinancialReportWorkflow();
    setWorkflow(defaultWorkflow);
  }, []);

  const handleNaturalLanguageSubmit = () => {
    if (!naturalLanguageInput.trim()) return;

    setIsGenerating(true);
    
    setTimeout(() => {
      try {
        const agentConfig = NaturalLanguageAgentConfig.parseAgentDescription(naturalLanguageInput);
        console.log('Generated agent config:', agentConfig);
        setNaturalLanguageInput('');
      } catch (error) {
        console.error('Error parsing natural language:', error);
      } finally {
        setIsGenerating(false);
      }
    }, 1000);
  };

  const handleSaveWorkflow = () => {
    if (!workflow) return;
    onWorkflowChange(workflow);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">🤖 AI Workflow Setup</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-xl"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-900 mb-3">🎯 Natural Language Agent Creation</h3>
              <p className="text-sm text-blue-700 mb-4">
                Describe your agent in plain English and the system will automatically create and configure it.
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Agent Description
                  </label>
                  <textarea
                    value={naturalLanguageInput}
                    onChange={(e) => setNaturalLanguageInput(e.target.value)}
                    placeholder="e.g., Create an agent called 'Financial Analyst' that specializes in balance sheets and income statements"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 h-24"
                  />
                </div>
                
                <button
                  onClick={handleNaturalLanguageSubmit}
                  disabled={isGenerating || !naturalLanguageInput.trim()}
                  className="px-6 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:bg-gray-400"
                >
                  {isGenerating ? 'Generating...' : 'Generate Agent'}
                </button>
              </div>
            </div>

            {workflow && (
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Workflow</h3>
                <div className="text-sm text-gray-600 space-y-2">
                  <div>Name: {workflow.name}</div>
                  <div>Agents: {workflow.agents.length}</div>
                  <div>Tasks: {workflow.tasks.length}</div>
                  <div>Parallel Execution: {workflow.config.parallel_execution ? 'Yes' : 'No'}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-gray-200 px-6 py-4">
          <div className="flex justify-end gap-4">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveWorkflow}
              className="px-6 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700"
            >
              Save Workflow
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowSetup;