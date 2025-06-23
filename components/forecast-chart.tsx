"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Calendar, TrendingUp, TrendingDown, BarChart3, Filter, Info, X, Search } from "lucide-react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
} from "recharts"

// shadcn/ui 컴포넌트 imports
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

// 날짜 유틸리티 함수들
const formatDate = (date, formatStr) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  if (formatStr === "yy-MM") return `${String(year).slice(2)}-${month}`;
  if (formatStr === "yyyy/MM/dd") return `${year}/${month}/${day}`;
  if (formatStr === "MM/dd") return `${month}/${day}`;
  if (formatStr === "yyyy-MM-dd") return `${year}-${month}-${day}`;
  if (formatStr === "yyyy년 MM월") return `${year}년 ${month}월`;
  return `${year}-${month}-${day}`;
};

const subMonths = (date, months) => {
  const result = new Date(date);
  result.setMonth(result.getMonth() - months);
  return result;
};

const addYears = (date, years) => {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
};

// 유틸리티 함수
function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

// MAPE 계산 함수는 제거 (API에서 받아오므로)

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

// --- 메인 차트 컴포넌트 ---
export function ForecastChart({
  allCompanies = [],
  selectedCompanyId = null,
  onCompanyChange = () => {},
  forecastData = [],
  actualSalesData = [],
  mapeValue = 0,  // API에서 받아온 MAPE 값
  sizeFilter,
  onSizeFilterChange
}) {
  const [dateRange, setDateRange] = React.useState(undefined);
  const [period, setPeriod] = React.useState("12months");
  const [chartType, setChartType] = React.useState("area");
  const [showActual, setShowActual] = React.useState(true);
  const [showForecast, setShowForecast] = React.useState(true);

  // 일별 실제 매출 데이터를 월별로 집계
  const monthlyActualSales = React.useMemo(() => {
    if (!actualSalesData || !Array.isArray(actualSalesData)) return [];

    const monthlyMap = new Map();
    actualSalesData.forEach(item => {
      const date = new Date(item.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
      const currentSum = monthlyMap.get(monthKey) || 0;
      monthlyMap.set(monthKey, currentSum + (item.quantity || 0));
    });

    return Array.from(monthlyMap.entries())
      .map(([date, quantity]) => ({ date, quantity }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [actualSalesData]);

  // 예측 데이터와 월별 실제 매출 데이터를 결합
  const combinedChartData = React.useMemo(() => {
    const dataMap = new Map();

    (forecastData || []).forEach(item => {
      const dateKey = item.predictedDate.split('T')[0];
      dataMap.set(dateKey, { ...dataMap.get(dateKey), predictedQuantity: item.predictedQuantity });
    });

    monthlyActualSales.forEach(item => {
      dataMap.set(item.date, { ...dataMap.get(item.date), actualSalesMonthly: item.quantity });
    });

    return Array.from(dataMap.entries())
      .map(([date, values]) => ({
        date,
        predictedQuantity: showForecast ? (values.predictedQuantity || 0) : 0,
        actualSalesMonthly: showActual ? (values.actualSalesMonthly || 0) : 0,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [forecastData, monthlyActualSales, showForecast, showActual]);

  // 선택된 날짜 범위에 따라 차트 데이터 필터링
  const filteredChartData = React.useMemo(() => {
    if (!dateRange?.from) return combinedChartData;

    const fromTime = dateRange.from.getTime();
    const toTime = dateRange.to ? dateRange.to.getTime() : Infinity;

    return combinedChartData.filter(d => {
      const date = new Date(d.date).getTime();
      return date >= fromTime && date <= toTime;
    });
  }, [combinedChartData, dateRange]);

  // 통계 계산
  const stats = React.useMemo(() => {
    const totalPredicted = filteredChartData.reduce((sum, item) => sum + item.predictedQuantity, 0);
    const totalActual = filteredChartData.reduce((sum, item) => sum + item.actualSalesMonthly, 0);
    
    // 월평균 계산 (소수점 버림)
    const monthCount = filteredChartData.length || 1;
    const avgPredicted = Math.floor(totalPredicted / monthCount);
    const avgActual = Math.floor(totalActual / monthCount);
    
    // 트렌드 계산 (첫 번째와 마지막 데이터 비교)
    const validData = filteredChartData.filter(item => item.predictedQuantity > 0);
    const trend = validData.length > 1 ? 
      ((validData[validData.length - 1].predictedQuantity - validData[0].predictedQuantity) / validData[0].predictedQuantity) * 100 : 0;

    return { avgPredicted, avgActual, mapeValue, trend };
  }, [filteredChartData, mapeValue]);

  // '기간 선택' 드롭다운 핸들러
  const handlePeriodChange = (value) => {
    setPeriod(value);
    const today = new Date();
    let from = undefined;
    let to = addYears(today, 5);

    switch (value) {
      case "6months":
        from = subMonths(today, 6);
        break;
      case "12months":
        from = subMonths(today, 12);
        break;
      case "24months":
        from = subMonths(today, 24);
        break;
      case "all":
      default:
        from = undefined;
        to = undefined;
        break;
    }
    setDateRange({ from, to });
  };
  
  // 컴포넌트 마운트 시 기본 기간 설정
  React.useEffect(() => {
    handlePeriodChange("all");
  }, []);

  const selectedCompany = allCompanies.find(c => String(c.customerId) === selectedCompanyId);

  // 차트 렌더링 함수
  const renderChart = () => {
    const commonProps = {
      data: filteredChartData,
      margin: { top: 20, right: 30, left: 20, bottom: 5 }
    };

    const chartContent = (
      <>
        <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
        <XAxis
          dataKey="date"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12 }}
          tickFormatter={(value) => formatDate(new Date(value), "yy-MM")}
          interval="preserveStartEnd"
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12 }}
          tickFormatter={(value) => value.toLocaleString()}
        />
      </>
    );

    switch (chartType) {
      case "line":
        return (
          <LineChart {...commonProps}>
            {chartContent}
            {showForecast && (
              <Line
                type="monotone"
                dataKey="predictedQuantity"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 4 }}
                name="예측 매출"
              />
            )}
            {showActual && (
              <Line
                type="monotone"
                dataKey="actualSalesMonthly"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 4 }}
                name="실제 매출"
              />
            )}
          </LineChart>
        );
      case "bar":
        return (
          <BarChart {...commonProps}>
            {chartContent}
            {showForecast && (
              <Bar dataKey="predictedQuantity" fill="#3b82f6" name="예측 매출" />
            )}
            {showActual && (
              <Bar dataKey="actualSalesMonthly" fill="#10b981" name="실제 매출" />
            )}
          </BarChart>
        );
      default:
        return (
          <AreaChart {...commonProps}>
            <defs>
              <linearGradient id="fillPredicted" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="fillActual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            {chartContent}
            {showForecast && (
              <Area
                type="monotone"
                dataKey="predictedQuantity"
                stackId="1"
                stroke="#3b82f6"
                fill="url(#fillPredicted)"
                strokeWidth={2}
                name="예측 매출"
              />
            )}
            {showActual && (
              <Area
                type="monotone"
                dataKey="actualSalesMonthly"
                stackId="2"
                stroke="#10b981"
                fill="url(#fillActual)"
                strokeWidth={2}
                name="실제 매출"
              />
            )}
          </AreaChart>
        );
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* 헤더 섹션 */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-bold">주문량 예측 차트</h1>
          <p className="text-gray-600 mt-2">회사별 주문 예측 및 실제 수량 분석</p>
        </div>

        {/* 선택된 회사 정보 */}
        {selectedCompany && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-base">
              <strong>{selectedCompany.companyName || `Customer ${selectedCompany.customerId}`} {selectedCompany.companySize && `(${selectedCompany.companySize})`}</strong>의 데이터를 분석 중입니다.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* 통계 카드들 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">월평균 예측 매출</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgPredicted.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">선택 기간 내</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">월평균 실제 매출</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgActual.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">선택 기간 내</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">예측 정확도 (MAPE)</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Mean Absolute Percentage Error - 낮을수록 좋음</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.mapeValue.toFixed(1)}%</div>
            <Progress value={Math.max(0, 100 - stats.mapeValue)} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">예측 트렌드</CardTitle>
            {stats.trend >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {stats.trend >= 0 ? '+' : ''}{stats.trend.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">기간 대비 변화</p>
          </CardContent>
        </Card>
      </div>

      {/* 메인 차트 카드 */}
      <Card className="w-full">
        <CardHeader className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-xl md:text-2xl">주문량 예측 추이</CardTitle>
              <CardDescription className="text-sm md:text-base mt-2">
                월별 매출 예측 및 실제 매출 비교 분석
              </CardDescription>
            </div>
          </div>
          
          <Tabs value={chartType} onValueChange={setChartType}>
            <TabsList>
              <TabsTrigger value="area">Area Chart</TabsTrigger>
              <TabsTrigger value="line">Line Chart</TabsTrigger>
              <TabsTrigger value="bar">Bar Chart</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* 컨트롤 섹션 */}
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap lg:flex-nowrap">
            {/* 기간 선택 */}
            <div className="w-full sm:w-auto">
              <Select value={period} onValueChange={handlePeriodChange}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="기간 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 기간</SelectItem>
                  <SelectItem value="6months">최근 6개월</SelectItem>
                  <SelectItem value="12months">최근 12개월</SelectItem>
                  <SelectItem value="24months">최근 24개월</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 날짜 범위 선택 */}
            <div className="w-full sm:w-auto">
              <DateRangePicker 
                date={dateRange} 
                onDateChange={setDateRange}
                className="w-full sm:w-auto"
              />
            </div>

            <Separator orientation="vertical" className="hidden lg:block h-8" />

            {/* 데이터 표시 옵션 */}
            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="show-forecast"
                  checked={showForecast}
                  onCheckedChange={setShowForecast}
                />
                <Label htmlFor="show-forecast" className="text-sm">예측 매출</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="show-actual"
                  checked={showActual}
                  onCheckedChange={setShowActual}
                />
                <Label htmlFor="show-actual" className="text-sm">실제 매출</Label>
              </div>
            </div>

            {/* 회사 선택 */}
            <div className="w-full sm:w-auto lg:ml-auto">
              <CompanySearchCombobox
                companies={allCompanies}
                value={selectedCompanyId}
                onSelect={onCompanyChange}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 md:p-6">
          <div className="h-[300px] md:h-[400px] lg:h-[500px] w-full">
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

function CompanySearchCombobox({
  companies,
  value,
  onSelect,
}) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const selectedCompany = companies.find(c => String(c.customerId) === value)

  const getDisplayValue = (company) => {
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
        <Button 
          variant="outline" 
          role="combobox" 
          aria-expanded={open}
          className="w-full sm:w-[280px] justify-between"
        >
          <span className="truncate text-left">
            {getDisplayValue(selectedCompany)}
          </span>
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
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-1"
                onClick={() => setSearchQuery("")}
              >
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
                  onClick={() => {
                    onSelect(String(company.customerId))
                    setOpen(false)
                    setSearchQuery("")
                  }}
                >
                  <Check 
                    className={cn(
                      "mr-2 h-4 w-4", 
                      value === String(company.customerId) ? "opacity-100" : "opacity-0"
                    )} 
                  />
                  <div className="flex-1 truncate">
                    <div className="font-medium">
                      {company.companyName || `Customer ${company.customerId}`}
                    </div>
                    {company.companySize && (
                      <Badge variant="secondary" className="text-xs mt-1">
                        {company.companySize}
                      </Badge>
                    )}
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

function DateRangePicker({
  date,
  onDateChange,
  className,
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "justify-start text-left font-normal",
            !date && "text-gray-500",
            className
          )}
        >
          <Calendar className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">
            {date?.from ? (
              date.to ? (
                <>
                  <span className="hidden sm:inline">
                    {formatDate(date.from, "yyyy/MM/dd")} - {formatDate(date.to, "yyyy/MM/dd")}
                  </span>
                  <span className="sm:hidden">
                    {formatDate(date.from, "MM/dd")} - {formatDate(date.to, "MM/dd")}
                  </span>
                </>
              ) : (
                formatDate(date.from, "yyyy/MM/dd")
              )
            ) : (
              <span>날짜 범위 선택</span>
            )}
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

// 기본 export 추가
export default ForecastChart;