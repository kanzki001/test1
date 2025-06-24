// =================================================================
// 2. app/api/customer-forecast/route.ts - 수정본
// =================================================================

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ✨ 타입 정의에 probability 추가
export type ForecastData = {
  cofId: number;
  customerId: number;
  companyName: string | null;
  customerName: string | null;
  companySize: string | null;
  predictedDate: string;
  predictedQuantity: number;
  mape: number | null;
  predictionModel: string;
  probability: number | null; // ✨ 새로 추가
  forecastGenerationDate: string;
};

export type ActualSalesData = {
  date: string;
  quantity: number;
};

export type CustomerForecastResponse = {
  customerId: number;
  companyName: string | null;
  customerName: string | null;
  companySize: string | null;
  forecasts: ForecastData[];
  actualSales: ActualSalesData[];
};

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const sizeOrder: { [key: string]: number } = {
      "대기업": 1,
      "중견기업": 2,
      "중소기업": 3,
    };

    // ✨ SELECT 쿼리에 PROBABILITY 추가
    const { data: rawForecasts, error: forecastError } = await supabase
      .from("customer_order_forecast")
      .select(`
        COF_ID,
        CUSTOMER_ID,
        PREDICTED_DATE,
        PREDICTED_QUANTITY,
        MAPE,
        PREDICTION_MODEL,
        PROBABILITY,
        FORECAST_GENERATION_DATETIME,
        customers (
          COMPANY_NAME,
          NAME,
          COMPANY_SIZE
        )
      `)
      .order("PREDICTED_DATE", { ascending: true });

    if (forecastError) {
      console.error("Supabase forecast fetch error:", forecastError);
      throw forecastError;
    }

    const customerIds = [...new Set(rawForecasts.map(f => f.CUSTOMER_ID))];

    // 실제 주문 데이터 가져오기 (기존과 동일)
    const { data: rawOrdersWithDetails, error: orderJoinError } = await supabase
        .from("orders")
        .select(`
            ORDER_DATE,
            QUANTITY,
            products (
                "SELLINGPRICE" 
            ),
            contacts (  
                CUSTOMER_ID 
            )
        `)
        .in('contacts.CUSTOMER_ID', customerIds) 
        .order("ORDER_DATE", { ascending: true });

    if (orderJoinError) {
        console.error("Supabase orders join fetch error:", orderJoinError);
        throw orderJoinError;
    }

    const actualSalesMap = new Map<number, Map<string, number>>();
    rawOrdersWithDetails.forEach(order => { 
        const customerId = order.contacts?.CUSTOMER_ID; 
        if (customerId === undefined || customerId === null) return; 

        const orderDate = new Date(order.ORDER_DATE);
        const yearMonthDay = `${orderDate.getFullYear()}-${(orderDate.getMonth() + 1).toString().padStart(2, '0')}-${orderDate.getDate().toString().padStart(2, '0')}`;
        
        const sellingPrice = order.products?.SELLINGPRICE || 0;
        const calculatedRevenue = order.QUANTITY * sellingPrice;

        if (!actualSalesMap.has(customerId)) {
            actualSalesMap.set(customerId, new Map<string, number>());
        }
        const customerDailyMap = actualSalesMap.get(customerId)!;
        customerDailyMap.set(yearMonthDay, (customerDailyMap.get(yearMonthDay) || 0) + calculatedRevenue);
    });
    
    // ✨ 예측 데이터 변환 시 probability 추가
    const forecastsData: ForecastData[] = rawForecasts.map(item => ({
        cofId: item.COF_ID,
        customerId: item.CUSTOMER_ID,
        companyName: item.customers?.COMPANY_NAME || null,
        customerName: item.customers?.NAME || null,
        companySize: item.customers?.COMPANY_SIZE || null,
        predictedDate: item.PREDICTED_DATE, 
        predictedQuantity: item.PREDICTED_QUANTITY,
        mape: item.MAPE,
        predictionModel: item.PREDICTION_MODEL,
        probability: item.PROBABILITY, // ✨ 새로 추가
        forecastGenerationDate: item.FORECAST_GENERATION_DATETIME 
    }));

    // 고객별로 데이터 그룹화 (기존과 동일)
    const customerMap = new Map<number, CustomerForecastResponse>();
    customerIds.forEach(cId => {
      const customerDetails = rawForecasts.find(rf => rf.CUSTOMER_ID === cId)?.customers;
      customerMap.set(cId, {
          customerId: cId,
          companyName: customerDetails?.COMPANY_NAME || null,
          customerName: customerDetails?.NAME || null,
          companySize: customerDetails?.COMPANY_SIZE || null,
          forecasts: [],
          actualSales: [],
      });
    });

    forecastsData.forEach(forecast => {
        if (customerMap.has(forecast.customerId)) {
            customerMap.get(forecast.customerId)!.forecasts.push(forecast);
        }
    });

    // ✨ 수정된 부분: 첫 매출부터 오늘까지 모든 날짜 포함 (0 포함)
    customerMap.forEach(customerData => {
        const customerId = customerData.customerId;
        const dailySalesForCustomer = actualSalesMap.get(customerId);
        
        if (dailySalesForCustomer && dailySalesForCustomer.size > 0) {
            // 첫 매출 날짜와 오늘 날짜 설정
            const dates = Array.from(dailySalesForCustomer.keys()).sort();
            const startDate = new Date(dates[0]);
            const today = new Date();
            
            // 첫 매출부터 오늘까지 모든 날짜 생성
            const allSalesData = [];
            for (let date = new Date(startDate); date <= today; date.setDate(date.getDate() + 1)) {
                const dateStr = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
                allSalesData.push({
                    date: dateStr,
                    quantity: dailySalesForCustomer.get(dateStr) || 0  // 매출 없으면 0
                });
            }
            
            customerData.actualSales = allSalesData;
        }
    });

    const customerForecastResponses: CustomerForecastResponse[] = Array.from(customerMap.values());
    
    // 각 회사의 총 매출 계산 (정렬용)
    customerForecastResponses.forEach(customer => {
        const totalSales = customer.actualSales.reduce((sum, sale) => sum + sale.quantity, 0);
        (customer as any).totalSales = totalSales;
    });

    // 매출 기준 상위 5개 회사 식별
    const topCompanies = [...customerForecastResponses]
        .sort((a, b) => ((b as any).totalSales || 0) - ((a as any).totalSales || 0))
        .slice(0, 5)
        .map(c => c.customerId);

    // 최종 응답 데이터 정렬: 주요 고객(매출순) + 기타 회사(abc순)
    customerForecastResponses.sort((a, b) => {
        const aIsTop = topCompanies.includes(a.customerId);
        const bIsTop = topCompanies.includes(b.customerId);

        // 둘 다 주요 고객이면 매출순
        if (aIsTop && bIsTop) {
            return ((b as any).totalSales || 0) - ((a as any).totalSales || 0);
        }

        // 하나만 주요 고객이면 주요 고객이 먼저
        if (aIsTop && !bIsTop) return -1;
        if (!aIsTop && bIsTop) return 1;

        // 둘 다 기타 회사면 abc순 (회사명 기준)
        const nameA = (a.companyName || `Customer ${a.customerId}`).toLowerCase();
        const nameB = (b.companyName || `Customer ${b.customerId}`).toLowerCase();
        return nameA.localeCompare(nameB);
    });

    // totalSales 속성 제거 (응답에서 불필요)
    customerForecastResponses.forEach(customer => {
        delete (customer as any).totalSales;
    });

    return NextResponse.json(customerForecastResponses);

  } catch (err: any) {
    console.error("❌ Supabase 처리 실패:", err);
    return NextResponse.json(
      {
        error: "데이터베이스 처리 중 오류가 발생했습니다.",
        detail: err.message,
      },
      { status: 500 }
    );
  }
}