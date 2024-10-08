import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { db, UrlResult } from '../db'
import { ChevronDown, ChevronUp, Edit, Trash2, RefreshCw } from 'lucide-react'
import { analyzeUrl } from './UrlAnalyzer'

const ResultsTable: React.FC = () => {
  const queryClient = useQueryClient()
  const { data: results = [] } = useQuery('urlResults', () =>
    db.urlResults.toArray()
  )
  const [expandedGroups, setExpandedGroups] = useState<string[]>([])
  const [expandedRows, setExpandedRows] = useState<number[]>([])

  const groupedResults = useMemo(() => {
    const groups: { [key: string]: UrlResult[] } = {}
    results.forEach(result => {
      const match = result.url.match(/\/sede\/portal\/([^/]+)/)
      const group = match ? match[1] : 'Other'
      if (!groups[group]) groups[group] = []
      groups[group].push(result)
    })
    return groups
  }, [results])

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev =>
      prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
    )
  }

  const toggleRow = (id: number) => {
    setExpandedRows(prev =>
      prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
    )
  }

  const getScoreLabel = (violations: any[]) => {
    const score = 100 - violations.length * 5 // Simple scoring system
    if (score >= 90) return { label: 'Excellent', color: 'text-green-600' }
    if (score >= 70) return { label: 'Good', color: 'text-blue-600' }
    if (score >= 50) return { label: 'Fair', color: 'text-yellow-600' }
    return { label: 'Poor', color: 'text-red-600' }
  }

  const deleteMutation = useMutation(
    (id: number) => db.urlResults.delete(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('urlResults')
      },
    }
  )

  const reanalyzeMutation = useMutation(
    async (result: UrlResult) => {
      const updatedResult = await analyzeUrl(result.url)
      return { ...result, ...updatedResult }
    },
    {
      onSuccess: async (updatedResult) => {
        await db.urlResults.put(updatedResult)
        queryClient.invalidateQueries('urlResults')
      },
    }
  )

  const handleEdit = (result: UrlResult) => {
    // Implement edit functionality
    console.log('Edit', result)
  }

  const handleDelete = (id: number) => {
    if (window.confirm('Are you sure you want to delete this result?')) {
      deleteMutation.mutate(id)
    }
  }

  const handleReanalyze = (result: UrlResult) => {
    reanalyzeMutation.mutate(result)
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full bg-white shadow-md rounded">
        <thead>
          <tr>
            <th className="p-3 text-left bg-gray-200">Group / URL</th>
            <th className="p-3 text-left bg-gray-200">Violations</th>
            <th className="p-3 text-left bg-gray-200">Score</th>
            <th className="p-3 text-left bg-gray-200">Timestamp</th>
            <th className="p-3 text-left bg-gray-200">Actions</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(groupedResults).map(([group, groupResults]) => (
            <React.Fragment key={group}>
              <tr className="bg-gray-100">
                <td colSpan={5} className="p-3">
                  <button
                    onClick={() => toggleGroup(group)}
                    className="font-bold flex items-center"
                  >
                    {expandedGroups.includes(group) ? <ChevronUp className="mr-2" /> : <ChevronDown className="mr-2" />}
                    {group} ({groupResults.length})
                  </button>
                </td>
              </tr>
              {expandedGroups.includes(group) && groupResults.map((result: UrlResult) => {
                const isExpanded = expandedRows.includes(result.id!)
                const { label, color } = getScoreLabel(result.violations)
                return (
                  <React.Fragment key={result.id}>
                    <tr className="border-b">
                      <td className="p-3 pl-8">{result.url.replace(`https://www.zaragoza.es/sede/portal/${group}`, '')}</td>
                      <td className="p-3">
                        <button
                          onClick={() => toggleRow(result.id!)}
                          className="text-blue-500 hover:text-blue-700 flex items-center"
                        >
                          {result.violations.length}
                          {isExpanded ? <ChevronUp className="ml-1" /> : <ChevronDown className="ml-1" />}
                        </button>
                      </td>
                      <td className={`p-3 font-semibold ${color}`}>{label}</td>
                      <td className="p-3">{new Date(result.timestamp).toLocaleString()}</td>
                      <td className="p-3">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEdit(result)}
                            className="text-blue-500 hover:text-blue-700"
                            title="Edit"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(result.id!)}
                            className="text-red-500 hover:text-red-700"
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                          <button
                            onClick={() => handleReanalyze(result)}
                            className="text-green-500 hover:text-green-700"
                            title="Re-analyze"
                          >
                            <RefreshCw size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={5} className="p-3 bg-gray-50">
                          <h4 className="font-semibold mb-2">Violations:</h4>
                          <ul className="list-disc pl-5">
                            {result.violations.map((violation, index) => (
                              <li key={index} className="mb-2">
                                <span className="font-medium">{violation.id}: </span>
                                {violation.description}
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default ResultsTable