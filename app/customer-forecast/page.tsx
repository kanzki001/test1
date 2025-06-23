// app/customer-forecast/page.tsx

"use client"

import * as React from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable, type Forecast } from "@/components/forecasts-data-table"
// ForecastChart와 그에 필요한 타입들을 임포트합니다.
import { ForecastChart, type Company, type Forecast as ChartForecastType, type ActualSales as ChartActualSalesType, type CompanySize } from "@/components/forecast-chart"
import { PageHeader } from "@/components/page-header"

// API 타입을 직접 정의 (API 응답과 동일하게)
type ForecastData = {
  cofId: number;
  customerId: number;
  companyName: string | null;
  customerName: string | null;
  companySize: string | null;
  predictedDate: string;
  predictedQuantity: number;
  mape: number | null;
  predictionModel: string;
  probability: number | null;
  forecastGenerationDate: string;
};

type ActualSalesData = {
  date: string;
  quantity: number;
};

type ApiCustomerForecastResponse = {
  customerId: number;
  companyName: string | null;
  customerName: string | null;
  companySize: string | null;
  forecasts: ForecastData[];
  actualSales: ActualSalesData[];
};

export default function CustomerForecastPage() {
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [allForecastData, setAllForecastData] = React.useState<ApiCustomerForecastResponse[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = React.useState<string>("all");
  const [sizeFilter, setSizeFilter] = React.useState<CompanySize>("all");
  const [isForecasting, setIsForecasting] = React.useState(false);

  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/customer-forecast`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`데이터를 불러오는 데 실패했습니다: ${response.status} ${errorText}`);
      }
      const result: ApiCustomerForecastResponse[] = await response.json();
      
      if (result && (result as any).error) {
        throw new Error((result as any).detail || "API에서 오류를 반환했습니다.");
      }
      
      setAllForecastData(result);
    } catch (err: any) {
      console.error("데이터 Fetching 실패:", err);
      setError(err.message || "데이터를 불러오는 데 실패했습니다.");
      setAllForecastData([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRunForecast = React.useCallback(async () => {
    console.log('새 예측 실행 시작...');
    setIsForecasting(true);
    
    try {
      const response = await fetch('/api/trigger-forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timestamp: new Date().toISOString() }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.detail || `HTTP ${response.status}: 예측 실행에 실패했습니다.`);
      }

      const result = await response.json();
      console.log('예측 실행 결과:', result);
      
      await fetchData();
      alert('새 예측이 성공적으로 완료되었습니다!');
      
    } catch (error) {
      console.error('예측 실행 실패:', error);
      alert(error instanceof Error ? error.message : '예측 실행 중 오류가 발생했습니다.');
    } finally {
      setIsForecasting(false);
    }
  }, [fetchData]);

  // 규모별 필터링된 회사 목록
  const filteredCompanies = React.useMemo<ApiCustomerForecastResponse[]>(() => {
    if (sizeFilter === "all") {
      return allForecastData;
    }
    return allForecastData.filter(c => c.companySize === sizeFilter);
  }, [allForecastData, sizeFilter]);

  // 차트 컴포넌트에 전달할 회사 목록 (전체 옵션 포함) - 원본 데이터 기준
  const companiesForSelector = React.useMemo<Company[]>(() => [
    { customerId: "all", companyName: "전체 회사", companySize: null },
    ...allForecastData.map(c => ({
      customerId: c.customerId,
      companyName: c.companyName,
      companySize: c.companySize,
    })),
  ], [allForecastData]);
  
  // 규모 필터가 변경되면 선택된 회사를 전체로 리셋
  React.useEffect(() => {
    setSelectedCompanyId("all");
  }, [sizeFilter]);

  // 차트 타입 변경 시 적절한 초기값 설정
  const [chartType, setChartType] = React.useState<"size" | "company">("size");
  
  React.useEffect(() => {
    if (chartType === "size") {
      setSelectedCompanyId("all");
    }
  }, [chartType]);

  // 선택된 회사명 계산
  const selectedCompanyName = React.useMemo(() => {
    if (selectedCompanyId === "all") {
      return sizeFilter === "all" ? "전체회사" : `전체 ${sizeFilter}`;
    }
    const company = filteredCompanies.find(c => String(c.customerId) === selectedCompanyId);
    return company?.companyName || company?.customerName || null;
  }, [selectedCompanyId, filteredCompanies, sizeFilter]);

  // 차트에 표시할 데이터 계산
  const chartDataForDisplay = React.useMemo(() => {
    let forecastsToDisplay: ChartForecastType[] = [];
    let actualSalesToDisplay: ChartActualSalesType[] = [];
    let mapeValue = 0;

    // 차트 타입에 따라 다른 로직 적용
    const dataSource = chartType === "size" ? filteredCompanies : 
                      selectedCompanyId === "all" ? allForecastData : 
                      allForecastData.filter(c => String(c.customerId) === selectedCompanyId);

    if (selectedCompanyId === "all" || chartType === "size") {
      // 전체 또는 규모별 데이터 집계
      const combinedForecastsMap = new Map<string, number>();
      const combinedActualSalesMap = new Map<string, number>();
      let totalMape = 0;
      let mapeCount = 0;

      dataSource.forEach(company => {
        // MAPE 계산
        const validMapes = (company.forecasts || [])
          .map(f => f.mape)
          .filter((mape): mape is number => mape !== null && mape !== undefined);
        
        if (validMapes.length > 0) {
          const companyMape = validMapes.reduce((sum, mape) => sum + mape, 0) / validMapes.length;
          totalMape += companyMape;
          mapeCount++;
        }

        // 예측 데이터 집계
        (company.forecasts || []).forEach(forecast => {
          const dateKey = forecast.predictedDate.split('T')[0];
          combinedForecastsMap.set(dateKey, (combinedForecastsMap.get(dateKey) || 0) + forecast.predictedQuantity);
        });

        // 실제 매출 데이터 집계
        (company.actualSales || []).forEach(sale => {
          const dateKey = sale.date;
          combinedActualSalesMap.set(dateKey, (combinedActualSalesMap.get(dateKey) || 0) + sale.quantity);
        });
      });

      mapeValue = mapeCount > 0 ? totalMape / mapeCount : 0;

      // 집계된 데이터를 배열로 변환
      forecastsToDisplay = Array.from(combinedForecastsMap.entries())
        .map(([date, quantity]) => ({ predictedDate: `${date}T00:00:00`, predictedQuantity: quantity }))
        .sort((a, b) => new Date(a.predictedDate).getTime() - new Date(b.predictedDate).getTime());
      
      actualSalesToDisplay = Array.from(combinedActualSalesMap.entries())
        .map(([date, quantity]) => ({ date: date, quantity: quantity }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    } else {
      // 특정 회사 데이터
      const company = allForecastData.find(c => String(c.customerId) === selectedCompanyId);
      if (company) {
        forecastsToDisplay = (company.forecasts || []).map(f => ({
          predictedDate: f.predictedDate,
          predictedQuantity: f.predictedQuantity
        }));
        actualSalesToDisplay = company.actualSales || [];

        // 해당 회사의 MAPE 계산
        const validMapes = (company.forecasts || [])
          .map(f => f.mape)
          .filter((mape): mape is number => mape !== null && mape !== undefined);
        
        mapeValue = validMapes.length > 0 
          ? validMapes.reduce((sum, mape) => sum + mape, 0) / validMapes.length 
          : 0;
      }
    }
    
    return { forecasts: forecastsToDisplay, actualSales: actualSalesToDisplay, mape: mapeValue };
  }, [selectedCompanyId, filteredCompanies, allForecastData, chartType]);

  // 테이블에 표시할 데이터 계산
  const tableData = React.useMemo<Forecast[]>(() => {
    // 차트 타입에 따라 다른 데이터 소스 사용
    const dataSource = chartType === "size" ? filteredCompanies : 
                      selectedCompanyId === "all" ? allForecastData : 
                      allForecastData.filter(c => String(c.customerId) === selectedCompanyId);

    if (selectedCompanyId === "all" || chartType === "size") {
      // 전체 또는 규모별 회사의 모든 예측 데이터
      return dataSource.flatMap(company => 
        (company.forecasts || []).map(f => ({
          cofId: f.cofId,
          customerId: f.customerId,
          companyName: company.companyName || f.companyName,
          customerName: company.customerName || f.customerName,
          companySize: company.companySize || f.companySize,
          predictedDate: f.predictedDate,
          predictedQuantity: f.predictedQuantity,
          mape: f.mape,
          predictionModel: f.predictionModel,
          probability: f.probability,
          forecastGenerationDate: f.forecastGenerationDate
        }))
      ).sort((a, b) => new Date(a.predictedDate).getTime() - new Date(b.predictedDate).getTime());
    }
    
    // 특정 회사의 예측 데이터
    const company = allForecastData.find(c => String(c.customerId) === selectedCompanyId);
    return (company?.forecasts || []).map(f => ({
      cofId: f.cofId,
      customerId: f.customerId,
      companyName: company.companyName || f.companyName,
      customerName: company.customerName || f.customerName,
      companySize: company.companySize || f.companySize,
      predictedDate: f.predictedDate,
      predictedQuantity: f.predictedQuantity,
      mape: f.mape,
      predictionModel: f.predictionModel,
      probability: f.probability,
      forecastGenerationDate: f.forecastGenerationDate
    })).sort((a, b) => new Date(a.predictedDate).getTime() - new Date(b.predictedDate).getTime());
  }, [selectedCompanyId, filteredCompanies, allForecastData, chartType]);

  const pageTitle = "고객 주문 예측";
  const pageDescription = "차트를 통해 회사별 예측 추이를 확인하고, 아래 테이블에서 상세 데이터를 관리하세요.";

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 md:p-8 space-y-6">
        <PageHeader title={pageTitle} description={pageDescription} />
        <Skeleton className="h-[250px] w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4 md:p-8 space-y-6">
        <PageHeader title={pageTitle} description={pageDescription} />
        <div className="text-red-500 font-bold">오류 발생: {error}</div>
      </div>
    );
  }

  if (!allForecastData || allForecastData.length === 0) {
    return (
        <div className="container mx-auto p-4 md:p-8 space-y-6">
            <PageHeader title={pageTitle} description={pageDescription} />
            <div className="text-center text-muted-foreground">
                <p>표시할 데이터가 없습니다.</p>
            </div>
        </div>
    );
  }

  return (
    <>
      <PageHeader
        title={pageTitle}
        description={pageDescription}
      />
      <div className="container mx-auto p-4 md:p-8">
        <div className="space-y-6">
          <ForecastChart
            allCompanies={companiesForSelector}
            selectedCompanyId={selectedCompanyId}
            onCompanyChange={setSelectedCompanyId}
            forecastData={chartDataForDisplay.forecasts}
            actualSalesData={chartDataForDisplay.actualSales}
            mapeValue={chartDataForDisplay.mape}
            sizeFilter={sizeFilter}
            onSizeFilterChange={setSizeFilter}
            chartType={chartType}
            onChartTypeChange={setChartType}
          />
          <DataTable 
            data={tableData} 
            onRunForecast={handleRunForecast}
            isForecasting={isForecasting}
            selectedCompanyName={selectedCompanyName}
          />
        </div>
      </div>
    </>
  );
}