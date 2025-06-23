"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Calendar, TrendingUp, TrendingDown, BarChart3, Filter, Info, X, Search } from "lucide-react"
import {
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
} from "recharts"

// shadcn/ui 컴포넌트 imports
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip as TooltipProvider, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

// 날짜 유틸리티 함수들
const formatDate = (date: Date, formatStr: string) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  if (formatStr === "yy-MM") return `${String(year).slice(2)}-${month}`;
  if (formatStr === "yyyy/MM/dd") return `${year}/${month}/${day}`;
  if (formatStr === "MM/dd") return `${month}/${day}`;
  if (formatStr === "yyyy-MM-dd") return `${year}-${month}-${day}`;
  return `${year}-${month}-${day}`;
};

const subMonths = (date: Date, months: number) => {
  const result = new Date(date);
  result.setMonth(result.getMonth() - months);
  return result;
};

const addMonths = (date: Date, months: number) => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}

// --- API 응답 및 데이터 타입 정의 ---
export type Forecast = {
  predictedDate: string;
  predictedQuantity: number;
};

export type ActualSales = {
  date: string;
  quantity: number;
};

export type Company = {
  customerId: number | string;
  companyName: string | null;
  companySize: string | null;
};

// 회사 규모 타입 정의
export type CompanySize = "all" | "대기업" | "중견기업" | "중소기업";

// 회사 규모 옵션
const COMPANY_SIZE_OPTIONS = [
  { value: "all" as const, label: "전체" },
  { value: "대기업" as const, label: "대기업" },
  { value: "중견기업" as const, label: "중견기업" },
  { value: "중소기업" as const, label: "중소기업" },
];

// --- 메인 차트 컴포넌트 ---
export function ForecastChart({
  allCompanies = [],
  selectedCompanyId = null,
  onCompanyChange = () => {},
  forecastData = [],
  actualSalesData = [],
  mapeValue = 0,
  sizeFilter = "all",
  onSizeFilterChange = () => {},
  chartType = "size",
  onChartTypeChange = () => {}
}: {
  allCompanies?: Company[];
  selectedCompanyId?: string | null;
  onCompanyChange?: (id: string) => void;
  forecastData?: Forecast[];
  actualSalesData?: ActualSales[];
  mapeValue?: number;
  sizeFilter?: CompanySize;
  onSizeFilterChange?: (value: CompanySize) => void;
  chartType?: "size" | "company";
  onChartTypeChange?: (value: "size" | "company") => void;
}) {
  const [dateRange, setDateRange] = React.useState<{ from?: Date; to?: Date }>({});
  const [period, setPeriod] = React.useState("12months");
  const [showActual, setShowActual] = React.useState(true);
  const [showForecast, setShowForecast] = React.useState(true);

  const monthlyActualSales = React.useMemo(() => {
    if (!actualSalesData || !Array.isArray(actualSalesData)) return [];
    const monthlyMap = new Map();
    actualSalesData.forEach(item => {
      const date = new Date(item.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
      const currentSum = monthlyMap.get(monthKey) || 0;
      monthlyMap.set(monthKey, currentSum + Number(item.quantity || 0));
    });
    return Array.from(monthlyMap.entries())
      .map(([date, quantity]) => ({ date, quantity }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [actualSalesData]);

  const combinedChartData = React.useMemo(() => {
    const dataMap = new Map();
    forecastData.forEach(item => {
      const dateKey = new Date(item.predictedDate.split('T')[0]).toISOString().split('T')[0];
      dataMap.set(dateKey, { ...dataMap.get(dateKey), predictedQuantity: Number(item.predictedQuantity) });
    });
    monthlyActualSales.forEach(item => {
      dataMap.set(item.date, { ...dataMap.get(item.date), actualSalesMonthly: Number(item.quantity) });
    });
    return Array.from(dataMap.entries())
      .map(([date, values]) => ({
        date,
        predictedQuantity: showForecast ? Number(values.predictedQuantity || 0) : 0,
        actualSalesMonthly: showActual ? Number(values.actualSalesMonthly || 0) : 0,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [forecastData, monthlyActualSales, showForecast, showActual]);

  const filteredChartData = React.useMemo(() => {
    if (!dateRange?.from) return combinedChartData;
    const fromTime = dateRange.from.getTime();
    const toTime = dateRange.to ? dateRange.to.getTime() : Date.now();
    return combinedChartData.filter(d => {
      const date = new Date(d.date).getTime();
      return !isNaN(date) && date >= fromTime && date <= toTime;
    });
  }, [combinedChartData, dateRange]);

  const stats = React.useMemo(() => {
    const totalPredicted = filteredChartData.reduce((sum, item) => sum + (item.predictedQuantity || 0), 0);
    const totalActual = filteredChartData.reduce((sum, item) => sum + (item.actualSalesMonthly || 0), 0);
    const monthCount = filteredChartData.length || 1;
    const avgPredicted = Math.floor(totalPredicted / monthCount);
    const avgActual = Math.floor(totalActual / monthCount);
    const validData = filteredChartData.filter(item => (item.predictedQuantity || 0) > 0);
    const trend = validData.length > 1 ? 
      ((validData[validData.length - 1].predictedQuantity - validData[0].predictedQuantity) / validData[0].predictedQuantity) * 100 : 0;
    return { avgPredicted, avgActual, mapeValue, trend };
  }, [filteredChartData, mapeValue]);

  const handlePeriodChange = (value: string) => {
    setPeriod(value);
    const today = new Date();
    let from: Date | undefined = undefined;
    let to: Date | undefined = undefined;
    
    switch (value) {
      case "6months": 
        from = subMonths(today, 6); 
        to = addMonths(today, 6);
        break;
      case "12months": 
        from = subMonths(today, 12); 
        to = addMonths(today, 12);
        break;
      case "24months": 
        from = subMonths(today, 24); 
        to = addMonths(today, 24);
        break;
      case "all": 
      default: 
        from = undefined; 
        to = undefined; 
        break;
    }
    setDateRange({ from, to });
  };

  React.useEffect(() => {
    handlePeriodChange("all");
  }, []);

  const selectedCompany = allCompanies.find(c => String(c.customerId) === selectedCompanyId);

  // 규모별 회사 수 계산 (전체 데이터 기준으로 계산)
  const companySizeStats = React.useMemo(() => {
    const stats = {
      all: allCompanies.filter(c => c.customerId !== "all").length, // "전체 회사" 제외
      대기업: allCompanies.filter(c => c.companySize === "대기업").length,
      중견기업: allCompanies.filter(c => c.companySize === "중견기업").length,
      중소기업: allCompanies.filter(c => c.companySize === "중소기업").length,
    };
    return stats;
  }, [allCompanies]);

  const renderChart = () => {
    const chartData = filteredChartData.length > 0 ? filteredChartData : [{ date: new Date().toISOString().split('T')[0], predictedQuantity: 0, actualSalesMonthly: 0 }];
    return (
      <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
        <XAxis
          dataKey="date"
          stroke="#333"
          tick={{ fontSize: 12 }}
          tickFormatter={(value) => formatDate(new Date(value), "yy-MM")}
          interval="preserveStartEnd"
        />
        <YAxis
          stroke="#333"
          tick={{ fontSize: 12 }}
          tickFormatter={(value: number) => {
            if (value >= 100000000) return (value / 100000000).toFixed(1).replace(/\.0$/, '') + '억';
            if (value >= 10000) return (value / 10000).toFixed(1).replace(/\.0$/, '') + '만';
            if (value >= 1000) return (value / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
            return value.toString();
          }}
        />
        <Tooltip
          contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc' }}
          itemStyle={{ color: '#000' }}
          formatter={(value: number) => value.toLocaleString()}
          labelFormatter={(label: string) => formatDate(new Date(label), "yyyy-MM-dd")}
        />
        {showForecast && (
          <Area
            type="monotone"
            dataKey="predictedQuantity"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.3}
            name="예측 매출"
          />
        )}
        {showActual && (
          <Area
            type="monotone"
            dataKey="actualSalesMonthly"
            stroke="#10b981"
            fill="#10b981"
            fillOpacity={0.3}
            name="실제 매출"
          />
        )}
      </AreaChart>
    );
  };

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-4">
        {/* 선택된 필터에 따른 Alert 메시지 */}
        {chartType === "size" ? (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-base">
              <strong className="text-3xl font-bold">
                {sizeFilter === "all" ? "전체 회사" : 
                 sizeFilter === "대기업" ? "대기업" :
                 sizeFilter === "중견기업" ? "중견기업" :
                 sizeFilter === "중소기업" ? "중소기업" : "전체 회사"}
              </strong>의 데이터를 분석 중입니다.
            </AlertDescription>
          </Alert>
        ) : (
          selectedCompany && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-base">
                <strong className="text-3xl font-bold">{selectedCompany.companyName || `Customer ${selectedCompany.customerId}`} {selectedCompany.companySize && `(${selectedCompany.companySize})`}</strong>의 데이터를 분석 중입니다.
              </AlertDescription>
            </Alert>
          )
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">월평균 예측 매출</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgPredicted.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">선택 기간 내</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">월평균 실제 매출</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgActual.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">선택 기간 내</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">예측 정확도 (MAPE)</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger><Info className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
                <TooltipContent><p>Mean Absolute Percentage Error - 낮을수록 좋음</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.mapeValue.toFixed(1)}%</div>
            <Progress value={Math.max(0, 100 - stats.mapeValue)} className="mt-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">예측 트렌드</CardTitle>
            {stats.trend >= 0 ? <TrendingUp className="h-4 w-4 text-green-600" /> : <TrendingDown className="h-4 w-4 text-red-600" />}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {stats.trend >= 0 ? '+' : ''}{stats.trend.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">기간 대비 변화</p>
          </CardContent>
        </Card>
      </div>

      <Card className="w-full">
        <CardHeader className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-xl md:text-2xl">주문량 예측 추이</CardTitle>
              <CardDescription className="text-sm md:text-base mt-2">월별 매출 예측 및 실제 매출 비교 분석</CardDescription>
            </div>
          </div>
          
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap lg:flex-nowrap">
            {/* 규모별/회사별 탭 */}
            <div className="w-full sm:w-auto">
              <Tabs value={chartType} onValueChange={onChartTypeChange}>
                <TabsList>
                  <TabsTrigger value="size">규모별</TabsTrigger>
                  <TabsTrigger value="company">회사별</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* 조건부 필터 렌더링 */}
            {chartType === "size" ? (
              /* 규모별 필터 */
              <div className="w-full sm:w-auto">
                <Select value={sizeFilter} onValueChange={onSizeFilterChange}>
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue placeholder="규모 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPANY_SIZE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center justify-between w-full">
                          <span>{option.label}</span>
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {companySizeStats[option.value]}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              /* 회사별 선택 */
              <div className="w-full sm:w-auto">
                <CompanySearchCombobox companies={allCompanies} value={selectedCompanyId} onSelect={onCompanyChange} />
              </div>
            )}

            {/* 기간 선택 */}
            <div className="w-full sm:w-auto">
              <Select value={period} onValueChange={handlePeriodChange}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="기간 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 기간</SelectItem>
                  <SelectItem value="6months">6개월</SelectItem>
                  <SelectItem value="12months">12개월</SelectItem>
                  <SelectItem value="24months">24개월</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 날짜 범위 선택 */}
            <div className="w-full sm:w-auto">
              <DateRangePicker date={dateRange} onDateChange={setDateRange} className="w-full sm:w-auto" />
            </div>
            
            <Separator orientation="vertical" className="hidden lg:block h-8" />
            
            {/* 차트 표시 옵션 */}
            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Switch id="show-actual" checked={showActual} onCheckedChange={setShowActual} />
                <Label htmlFor="show-actual" className="text-sm">실제 매출</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="show-forecast" checked={showForecast} onCheckedChange={setShowForecast} />
                <Label htmlFor="show-forecast" className="text-sm">예측 매출</Label>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {renderChart()}
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// --- 하위 컴포넌트들 ---

function CompanySearchCombobox({ companies, value, onSelect }: { companies: Company[]; value: string | null; onSelect: (id: string) => void }) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const selectedCompany = companies.find(c => String(c.customerId) === value)

  const getDisplayValue = (company: Company | undefined) => {
    if (!company) return "회사를 선택하세요...";
    const name = company.companyName || `Customer ${company.customerId}`;
    return company.companySize ? `${name} (${company.companySize})` : name;
  }

  const filteredCompanies = companies.filter(company => {
    const searchText = `${company.companyName || ''} ${company.companySize || ''}`.toLowerCase();
    return searchText.includes(searchQuery.toLowerCase());
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full sm:w-[280px] justify-between">
          <span className="truncate text-left">{getDisplayValue(selectedCompany)}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="p-2">
          <div className="flex items-center border rounded px-3 py-2">
            <Search className="h-4 w-4 mr-2 text-gray-400" />
            <input
              type="text"
              placeholder="회사명 또는 규모로 검색..."
              className="flex-1 text-sm outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <Button variant="ghost" size="sm" className="h-auto p-1" onClick={() => setSearchQuery("")}>
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          <div className="mt-2 max-h-60 overflow-auto">
            {filteredCompanies.length === 0 ? (
              <div className="p-3 text-sm text-gray-500 text-center">검색 결과가 없습니다.</div>
            ) : (
              filteredCompanies.map((company) => (
                <div
                  key={company.customerId}
                  className="flex items-center p-2 cursor-pointer hover:bg-gray-100 rounded text-sm"
                  onClick={() => { onSelect(String(company.customerId)); setOpen(false); setSearchQuery(""); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === String(company.customerId) ? "opacity-100" : "opacity-0")} />
                  <div className="flex-1 truncate">
                    <div className="font-medium">{company.companyName || `Customer ${company.customerId}`}</div>
                    {company.companySize && <Badge variant="secondary" className="text-xs mt-1">{company.companySize}</Badge>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function DateRangePicker({ date, onDateChange, className }: { date: { from?: Date; to?: Date }; onDateChange: (range: { from?: Date; to?: Date }) => void; className?: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("justify-start text-left font-normal", !date && "text-gray-500", className)}
        >
          <Calendar className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">
            {date?.from ? (date.to ? `${formatDate(date.from, "yyyy/MM/dd")} - ${formatDate(date.to, "yyyy/MM/dd")}` : formatDate(date.from, "yyyy/MM/dd")) : "날짜 범위 선택"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-4">
          <p className="text-sm text-gray-600 mb-3 font-medium">날짜 범위를 선택하세요</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">시작일</Label>
              <input
                type="date"
                className="w-full p-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={date?.from ? formatDate(date.from, "yyyy-MM-dd") : ""}
                onChange={(e) => {
                  const newDate = e.target.value ? new Date(e.target.value) : undefined;
                  onDateChange({ ...date, from: newDate });
                }}
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">종료일</Label>
              <input
                type="date"
                className="w-full p-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={date?.to ? formatDate(date.to, "yyyy-MM-dd") : ""}
                onChange={(e) => {
                  const newDate = e.target.value ? new Date(e.target.value) : undefined;
                  onDateChange({ ...date, to: newDate });
                }}
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default ForecastChart;