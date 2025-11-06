import React, { useState, useEffect } from 'react';
import { 
  NaturalLanguageAgentConfig, 
  CrewAIWorkflowEngine, 
  createFinancialReportWorkflow,
  Agent,
  Task,
  Workflow,
  Tool
} from '../services/crewaiWorkflow';

interface WorkflowBuilderProps {
  onWorkflowChange: (workflow: Workflow) => void;
  onClose: () => void;
}

const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({ onWorkflowChange, onClose }) => {
  const [activeTab, setActiveTab] = useState<'agents' | 'tasks' | 'workflow' | 'preview'>('agents');
  const [naturalLanguageInput, setNaturalLanguageInput] = useState('');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewResults, setPreviewResults] = useState<Map<string, any> | null>(null);

  useEffect(() => {
    // Load default workflow
    const defaultWorkflow = createFinancialReportWorkflow();
    setWorkflow(defaultWorkflow);
    setAgents(defaultWorkflow.agents);
    setTasks(defaultWorkflow.tasks);
  }, []);

  const handleNaturalLanguageSubmit = () => {
    if (!naturalLanguageInput.trim()) return;

    setIsGenerating(true);
    
    // Simulate parsing delay
    setTimeout(() => {
      try {
        const agentConfig = NaturalLanguageAgentConfig.parseAgentDescription(naturalLanguageInput);
        
        // Create new agent from natural language
        const newAgent: Agent = {
          id: agentConfig.id || `agent-${Date.now()}`,
          name: agentConfig.name || 'New Agent',
          role: agentConfig.role || 'AI Agent',
          goal: agentConfig.goal || 'Complete assigned tasks',
          backstory: agentConfig.backstory || 'Specialized AI agent',
          tools: agentConfig.tools || [],
          llm: agentConfig.llm || {
            provider: 'gemini',
            apiKey: '',
            model: 'gemini-2.5-flash',
            voiceModel: 'elevenlabs/eleven-multilingual-v2'
          },
          verbose: agentConfig.verbose ?? true,
          allow_delegation: agentConfig.allow_delegation ?? false,
          max_iter: agentConfig.max_iter ?? 3,
          max_execution_time: agentConfig.max_execution_time ?? 300,
          memory: agentConfig.memory ?? true
        };

        setAgents(prev => [...prev, newAgent]);
        setNaturalLanguageInput('');
        
        console.log('✅ Generated agent from natural language:', newAgent);
      } catch (error) {
        console.error('❌ Error parsing natural language:', error);
      } finally {
        setIsGenerating(false);
      }
    }, 1000);
  };

  const handleAddTask = (description: string, agentId: string) => {
    const newTask: Task = {
      id: `task-${Date.now()}`,
      description,
      expected_output: 'Task output',
      agent: agentId,
      tools: [],
      context: 'Generated from workflow'
    };
    
    setTasks(prev => [...prev, newTask]);
  };

  const handlePreviewWorkflow = async () => {
    if (!workflow) return;

    setIsGenerating(true);
    
    try {
      const engine = new CrewAIWorkflowEngine(workflow);
      const results = await engine.execute();
      setPreviewResults(results);
    } catch (error) {
      console.error('Error in workflow preview:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveWorkflow = () => {
    if (!workflow) return;

    const updatedWorkflow: Workflow = {
      ...workflow,
      agents,
      tasks
    };
    
    setWorkflow(updatedWorkflow);
    onWorkflowChange(updatedWorkflow);
    onClose();
  };

  const examplePrompts = [
    "Create an agent called 'Data Extractor' that specializes in extracting information from financial documents using OCR and should use Claude 3.5 Sonnet with verbose output",
    "Generate an agent named 'Math Verifier' that checks calculations and mathematical accuracy with 5 iterations maximum and can delegate tasks",
    "Build an agent for 'Report Writer' that creates professional reports with GPT-4 and has 10 minutes execution time",
    "Create an agent called 'Quality Checker' that validates data consistency using memory and is designed to work with Excel files"
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden">
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">🤖 AI Workflow Builder</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-xl"
            >
              ×
            </button>
          </div>
        </div>

        <div className="border-b border-gray-200">
          <nav className="flex px-6" aria-label="Tabs">
            {[
              { id: 'agents', name: 'Agent Creation' },
              { id: 'tasks', name: 'Task Definition' },
              { id: 'workflow', name: 'Workflow Setup' },
              { id: 'preview', name: 'Preview & Test' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`${
                  activeTab === tab.id
                    ? 'border-sky-600 text-sky-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm transition-colors`}
              >
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {activeTab === 'agents' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-blue-900 mb-3">🎯 Natural Language Agent Creation</h3>
                <p className="text-sm text-blue-700 mb-4">
                  Describe your agent in plain English and the system will automatically create and configure it with the appropriate tools and settings.
                </p>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Agent Description
                    </label>
                    <textarea
                      value={naturalLanguageInput}
                      onChange={(e) => setNaturalLanguageInput(e.target.value)}
                      placeholder="e.g., Create an agent called 'Financial Analyst' that specializes in analyzing balance sheets and income statements with expertise in Australian accounting standards. The agent should use Claude 3.5 Sonnet, have verbose output, and can perform up to 3 iterations with 5-minute timeout."
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 h-24"
                    />
                  </div>
                  
                  <button
                    onClick={handleNaturalLanguageSubmit}
                    disabled={isGenerating || !naturalLanguageInput.trim()}
                    className="px-6 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:bg-gray-400 flex items-center gap-2"
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Generating Agent...
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Generate Agent
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">💡 Example Prompts</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {examplePrompts.map((prompt, index) => (
                    <button
                      key={index}
                      onClick={() => setNaturalLanguageInput(prompt)}
                      className="text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
                    >
                      <p className="text-sm text-gray-700">{prompt}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">👥 Configured Agents ({agents.length})</h3>
                <div className="space-y-3">
                  {agents.map((agent, index) => (
                    <div key={agent.id} className="bg-white p-4 rounded-lg border border-gray-200">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-semibold text-gray-900">{agent.name}</h4>
                        <span className="text-xs px-2 py-1 bg-sky-100 text-sky-700 rounded-full">
                          {agent.llm.provider}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{agent.role}</p>
                      <div className="text-xs text-gray-500 space-y-1">
                        <div>Model: {agent.llm.model}</div>
                        <div>Tools: {agent.tools.length} configured</div>
                        <div>Max Iter: {agent.max_iter} | Timeout: {agent.max_execution_time}s</div>
                        {agent.memory && <div>Memory: Enabled</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'tasks' && (
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-semibold text-green-900 mb-2">📋 Task Definition</h3>
                <p className="text-sm text-green-700">
                  Define tasks for your agents to execute. Tasks can depend on other tasks to create complex workflows.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Available Agents</h4>
                  <div className="space-y-2">
                    {agents.map(agent => (
                      <div key={agent.id} className="p-3 bg-gray-50 rounded-lg border">
                        <div className="font-medium text-sm">{agent.name}</div>
                        <div className="text-xs text-gray-500">{agent.role}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Define New Task</h4>
                  <div className="space-y-3">
                    {agents.map(agent => (
                      <div key={agent.id} className="p-3 border border-gray-200 rounded-lg">
                        <div className="font-medium text-sm mb-2">{agent.name}</div>
                        <button
                          onClick={() => handleAddTask(`Task for ${agent.name}`, agent.id)}
                          className="text-xs px-3 py-1 bg-sky-100 text-sky-700 rounded hover:bg-sky-200"
                        >
                          Add Task
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Configured Tasks ({tasks.length})</h4>
                <div className="space-y-2">
                  {tasks.map(task => {
                    const agent = agents.find(a => a.id === task.agent);
                    return (
                      <div key={task.id} className="p-3 bg-white border border-gray-200 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium text-sm">{task.description}</div>
                            <div className="text-xs text-gray-500">Agent: {agent?.name || task.agent}</div>
                            <div className="text-xs text-gray-500">Expected: {task.expected_output}</div>
                          </div>
                          <button
                            onClick={() => setTasks(prev => prev.filter(t => t.id !== task.id))}
                            className="text-red-500 hover:text-red-700 text-xs"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'workflow' && (
            <div className="space-y-6">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h3 className="font-semibold text-purple-900 mb-2">🔄 Workflow Configuration</h3>
                <p className="text-sm text-purple-700">
                  Configure how tasks are executed, dependencies, and overall workflow behavior.
                </p>
              </div>

              {workflow && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-900">Execution Settings</h4>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Execution Mode
                      </label>
                      <select
                        value={workflow.config.parallel_execution ? 'parallel' : 'sequential'}
                        onChange={(e) => setWorkflow({
                          ...workflow,
                          config: { ...workflow.config, parallel_execution: e.target.value === 'parallel' }
                        })}
                        className="w-full p-2 border border-gray-300 rounded-lg"
                      >
                        <option value="sequential">Sequential (One task at a time)</option>
                        <option value="parallel">Parallel (Multiple tasks simultaneously)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Max Workers (for parallel execution)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={workflow.config.max_workers}
                        onChange={(e) => setWorkflow({
                          ...workflow,
                          config: { ...workflow.config, max_workers: parseInt(e.target.value) }
                        })}
                        className="w-full p-2 border border-gray-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Error Handling
                      </label>
                      <select
                        value={workflow.config.error_handling}
                        onChange={(e) => setWorkflow({
                          ...workflow,
                          config: { ...workflow.config, error_handling: e.target.value as any }
                        })}
                        className="w-full p-2 border border-gray-300 rounded-lg"
                      >
                        <option value="continue">Continue on error</option>
                        <option value="stop">Stop on error</option>
                        <option value="retry">Retry on error</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-900">Memory & Performance</h4>
                    
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="memory-enabled"
                        checked={workflow.config.memory_enabled}
                        onChange={(e) => setWorkflow({
                          ...workflow,
                          config: { ...workflow.config, memory_enabled: e.target.checked }
                        })}
                        className="rounded border-gray-300"
                      />
                      <label htmlFor="memory-enabled" className="text-sm text-gray-700">
                        Enable Memory (store results between tasks)
                      </label>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tool Timeout (seconds)
                      </label>
                      <input
                        type="number"
                        min="30"
                        max="3600"
                        value={workflow.config.tool_timeout}
                        onChange={(e) => setWorkflow({
                          ...workflow,
                          config: { ...workflow.config, tool_timeout: parseInt(e.target.value) }
                        })}
                        className="w-full p-2 border border-gray-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Max Retries
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="5"
                        value={workflow.config.max_retries}
                        onChange={(e) => setWorkflow({
                          ...workflow,
                          config: { ...workflow.config, max_retries: parseInt(e.target.value) }
                        })}
                        className="w-full p-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-semibold text-yellow-800 mb-2">📊 Workflow Summary</h4>
                <div className="text-sm text-yellow-700 space-y-1">
                  <div>Agents: {agents.length}</div>
                  <div>Tasks: {tasks.length}</div>
                  <div>Dependencies: {Object.keys(workflow?.dependencies || {}).length}</div>
                  <div>Mode: {workflow?.config.parallel_execution ? 'Parallel' : 'Sequential'}</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'preview' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">🔍 Workflow Preview & Test</h3>
                <button
                  onClick={handlePreviewWorkflow}
                  disabled={isGenerating || !workflow}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                >
                  {isGenerating ? 'Running...' : 'Test Workflow'}
                </button>
              </div>

              {previewResults && (
                <div className="bg-white p-6 rounded-lg border border-gray-200">
                  <h4 className="font-semibold text-gray-900 mb-4">Execution Results</h4>
                  <div className="space-y-3">
                    {Array.from(previewResults.entries()).map(([taskId, result]) => (
                      <div key={taskId} className="p-3 bg-gray-50 rounded-lg border">
                        <div className="font-medium text-sm text-gray-900">{taskId}</div>
                        <div className="text-xs text-gray-600 mt-1">
                          {typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">🚀 Ready to Deploy</h4>
                <p className="text-sm text-blue-700 mb-3">
                  Your workflow is configured and ready to be integrated into the financial report generation system.
                </p>
                <button
                  onClick={handleSaveWorkflow}
                  className="px-6 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700"
                >
                  Save & Use Workflow
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 px-6 py-4">
          <div className="flex justify-end gap-4">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowBuilder;