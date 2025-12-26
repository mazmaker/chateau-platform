import { useState } from 'react';
import { Calendar, Building, Filter, Search } from 'lucide-react';

const GlobalFilters = () => {
  const [dateRange, setDateRange] = useState('this-month');
  const [selectedProject, setSelectedProject] = useState('all');
  const [propertyType, setPropertyType] = useState('all');

  const projects = [
    { id: 'all', name: 'ทุกโครงการ' },
    { id: 'baan-issara', name: 'บ้านอิศรา' },
    { id: 'the-noble', name: 'เดอะ โนเบิล' },
    { id: 'supalai', name: 'ศุภาลัย' },
    { id: 'land-and-house', name: 'แลนด์แอนด์เฮาส์' },
  ];

  const propertyTypes = [
    { id: 'all', name: 'ทุกประเภท' },
    { id: 'condo', name: 'คอนโด' },
    { id: 'townhouse', name: 'ทาวน์เฮาส์' },
    { id: 'single-house', name: 'บ้านเดี่ยว' },
    { id: 'commercial', name: 'พาณิชย์' },
  ];

  const dateRanges = [
    { id: 'today', name: 'วันนี้' },
    { id: 'this-week', name: 'สัปดาห์นี้' },
    { id: 'this-month', name: 'เดือนนี้' },
    { id: 'last-month', name: 'เดือนที่แล้ว' },
    { id: 'this-quarter', name: 'ไตรมาสนี้' },
    { id: 'this-year', name: 'ปีนี้' },
    { id: 'custom', name: 'กำหนดเอง' },
  ];

  return (
    <div className="bg-white rounded-lg border border-[#e2e8f0] p-4 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Filter className="w-4 h-4 text-gray-600" />
        <h3 className="text-sm font-semibold text-gray-900">ตัวกรองข้อมูลหลัก</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Date Range Filter */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-600 font-medium flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            ช่วงเวลา
          </label>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 text-sm border border-[#e2e8f0] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {dateRanges.map(range => (
              <option key={range.id} value={range.id}>
                {range.name}
              </option>
            ))}
          </select>
        </div>

        {/* Project Filter */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-600 font-medium flex items-center gap-1">
            <Building className="w-3 h-3" />
            โครงการ
          </label>
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="px-3 py-2 text-sm border border-[#e2e8f0] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {projects.map(project => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

        {/* Property Type Filter */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-600 font-medium">ประเภทอสังหาฯ</label>
          <select
            value={propertyType}
            onChange={(e) => setPropertyType(e.target.value)}
            className="px-3 py-2 text-sm border border-[#e2e8f0] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {propertyTypes.map(type => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </div>

        {/* Search Filter */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-600 font-medium">ค้นหา</label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="ค้นหาลูกค้า, โครงการ..."
              className="w-full pl-10 pr-3 py-2 text-sm border border-[#e2e8f0] rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Filter Tags Display */}
      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[#e2e8f0]">
        <span className="text-xs text-gray-600">ตัวกรองที่เลือก:</span>
        <div className="flex gap-2">
          <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-indigo-100 text-indigo-800 rounded-full">
            {dateRanges.find(r => r.id === dateRange)?.name}
          </span>
          {selectedProject !== 'all' && (
            <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
              {projects.find(p => p.id === selectedProject)?.name}
            </span>
          )}
          {propertyType !== 'all' && (
            <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
              {propertyTypes.find(t => t.id === propertyType)?.name}
            </span>
          )}
        </div>
        <button className="ml-auto text-xs text-red-600 hover:text-red-800 font-medium">
          ล้างตัวกรอง
        </button>
      </div>
    </div>
  );
};

export default GlobalFilters;