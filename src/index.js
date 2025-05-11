import React, { useState, useCallback, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

// 렌탈 계산기 컴포넌트
const RentalCalculator = () => {
  // 상태 관리
  const [products, setProducts] = useState([]);
  const [supplyRatePercent, setSupplyRatePercent] = useState(75);
  const [rentalPeriods] = useState([12, 24, 36, 48]);
  const [selectedPeriod, setSelectedPeriod] = useState(12);
  const [discountRates, setDiscountRates] = useState({
    12: 100,
    24: 106,
    36: 111,
    48: 116
  });
  const [rentalFeeRates, setRentalFeeRates] = useState({
    12: 21,
    24: 26,
    36: 28,
    48: 31
  });
  const [calculatedProducts, setCalculatedProducts] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fileUploaded, setFileUploaded] = useState(false);
  const [activeTab, setActiveTab] = useState('upload'); // 'upload', 'settings', 'results'
  const [isDragging, setIsDragging] = useState(false);
  
  // 단일 상품 입력을 위한 상태
  const [singleProduct, setSingleProduct] = useState({
    productName: '',
    modelName: '',
    price: ''
  });

  // 스타일 관련 클래스 상수 정의
  const buttonStyles = {
    primary: "px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105 hover:shadow-purple-500/30 active:scale-95 active:shadow-inner",
    secondary: "px-4 py-2 bg-gray-700 text-gray-300 rounded-lg transition-all duration-300 hover:bg-gray-600 hover:scale-105 hover:shadow-md active:scale-95 active:shadow-inner",
    danger: "px-4 py-2 bg-red-900/30 text-red-300 rounded-lg transition-all duration-300 hover:bg-red-900/50 hover:scale-105 hover:shadow-md active:scale-95 active:shadow-inner",
    export: "px-4 py-2 bg-purple-900/30 text-purple-300 rounded-lg transition-all duration-300 hover:bg-purple-900/50 hover:scale-105 hover:shadow-md active:scale-95 active:shadow-inner",
    special: "px-4 py-2 bg-purple-900 text-purple-200 rounded-lg transition-all duration-300 hover:bg-purple-800 hover:scale-105 hover:shadow-md hover:shadow-purple-500/20 active:scale-95 active:shadow-inner"
  };

  // 공급단가율 변경 핸들러
  const handleSupplyRateChange = (e) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value > 0) {
      setSupplyRatePercent(value);
    }
  };

  // 할인률 변경 핸들러
  const handleDiscountRateChange = (period, e) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value > 0) {
      setDiscountRates({
        ...discountRates,
        [period]: value
      });
    }
  };

  // 렌탈수수료율 변경 핸들러
  const handleRentalFeeRateChange = (period, e) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= 0) {
      setRentalFeeRates({
        ...rentalFeeRates,
        [period]: value
      });
    }
  };

  // 렌탈 기간 선택 핸들러
  const handlePeriodChange = (e) => {
    setSelectedPeriod(parseInt(e.target.value, 10));
  };

  // 단일 상품 입력 핸들러
  const handleSingleProductChange = (e) => {
    const { name, value } = e.target;
    setSingleProduct({
      ...singleProduct,
      [name]: value
    });
  };

  // 단일 상품 추가 핸들러
  const handleAddSingleProduct = () => {
    // 유효성 검사
    if (!singleProduct.productName || !singleProduct.modelName || !singleProduct.price) {
      setError('모든 필드를 입력해주세요.');
      return;
    }

    const price = parseFloat(singleProduct.price.replace(/,/g, ''));
    if (isNaN(price) || price <= 0) {
      setError('유효한 가격을 입력해주세요.');
      return;
    }

    const newProduct = {
      productName: singleProduct.productName,
      modelName: singleProduct.modelName,
      price: price
    };

    setProducts([...products, newProduct]);
    setFileUploaded(true);
    
    // 입력 필드 초기화
    setSingleProduct({
      productName: '',
      modelName: '',
      price: ''
    });
    
    // 계산 설정 탭으로 이동
    setActiveTab('settings');
  };

  // 계산 결과 리셋 핸들러
  const resetCalculation = () => {
    setCalculatedProducts([]);
    setActiveTab('settings');
    setError('');
  };

  // 드래그 앤 드롭 핸들러
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload({ target: { files } });
    }
  };

  // 샘플 엑셀 양식 다운로드 함수
  const downloadSampleTemplate = () => {
    try {
      console.log('샘플 엑셀 양식 다운로드 시작');
      
      // 샘플 데이터 생성
      const sampleData = [
        {
          '제품명': '에어컨',
          '모델명': 'AC-2000',
          '일시불단가': 1200000
        },
        {
          '제품명': '냉장고',
          '모델명': 'REF-500',
          '일시불단가': 1500000
        }
      ];
      
      // 워크시트 생성
      const worksheet = XLSX.utils.json_to_sheet(sampleData);
      
      // 워크북 생성
      const workbook = XLSX.utils.book_new();
      
      // 워크시트를 워크북에 추가
      XLSX.utils.book_append_sheet(workbook, worksheet, '제품목록');
      
      // 파일 저장
      XLSX.writeFile(workbook, '렌탈계산기_샘플양식.xlsx');
      
      console.log('샘플 엑셀 양식 다운로드 완료');
    } catch (error) {
      console.error('샘플 엑셀 양식 다운로드 오류:', error);
      setError('샘플 양식 다운로드 중 오류가 발생했습니다: ' + error.message);
    }
  };

  // 파일 업로드 핸들러
  const handleFileUpload = (e) => {
    console.log('파일 업로드 시작');
    const file = e.target.files?.[0];
    
    if (!file) {
      console.log('파일이 선택되지 않음');
      return;
    }
    
    // 파일 형식 확인
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    console.log('파일 확장자:', fileExtension);
    if (!fileExtension || !['xlsx', 'xls', 'csv'].includes(fileExtension)) {
      setError('지원되는 파일 형식은 xlsx, xls, csv입니다.');
      return;
    }
    
    setLoading(true);
    setError('');
    
    // 파일 처리 타임아웃 설정 (30초)
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.log('파일 처리 타임아웃 발생');
        setError('파일 처리 시간이 너무 오래 걸립니다. 파일 크기를 확인하거나 다시 시도해주세요.');
        setLoading(false);
      }
    }, 30000);
    
    try {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          console.log('파일 로드 완료, 처리 시작');
          clearTimeout(timeoutId); // 타임아웃 제거
          
          const arrayBuffer = event.target.result;
          let jsonData = [];
          
          if (!arrayBuffer) {
            throw new Error('파일 데이터를 읽을 수 없습니다.');
          }
          
          try {
            // CSV 파일 처리
            if (file.name.toLowerCase().endsWith('.csv')) {
              console.log('CSV 파일 처리');
              const csvText = new TextDecoder().decode(new Uint8Array(arrayBuffer));
              const parseResult = Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true,
                dynamicTyping: true
              });
              
              if (parseResult.errors && parseResult.errors.length > 0) {
                console.error('CSV 파싱 오류:', parseResult.errors);
                throw new Error('CSV 파일 형식에 오류가 있습니다.');
              }
              
              jsonData = parseResult.data || [];
              console.log('CSV 파싱 완료, 데이터 수:', jsonData.length);
            } else {
              // 엑셀 파일 처리
              console.log('엑셀 파일 처리');
              const options = { 
                type: 'array', 
                cellDates: true, 
                cellNF: false,
                cellText: false
              };
              
              // 엑셀 파싱 시 오류 처리 강화
              try {
                const workbook = XLSX.read(new Uint8Array(arrayBuffer), options);
                console.log('엑셀 파일 읽기 성공, 시트 수:', workbook.SheetNames.length);
                
                if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
                  throw new Error('엑셀 파일에 시트가 없습니다.');
                }
                
                const firstSheet = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheet];
                
                if (!worksheet) {
                  throw new Error('워크시트를 읽을 수 없습니다.');
                }
                
                // JSON으로 변환 전에 워크시트 유효성 확인
                if (!worksheet['!ref']) {
                  throw new Error('워크시트에 데이터가 없습니다.');
                }
                
                // 워크시트를 JSON으로 변환
                jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
                console.log('시트 데이터 변환 성공, 행 수:', jsonData.length);
              } catch (xlsxError) {
                console.error('엑셀 파싱 상세 오류:', xlsxError);
                throw new Error('엑셀 파일 형식에 문제가 있거나 손상되었습니다: ' + xlsxError.message);
              }
            }
          } catch (parseError) {
            console.error('파일 파싱 오류:', parseError);
            setError('파일 분석 중 오류가 발생했습니다: ' + parseError.message);
            setLoading(false);
            return;
          }
          
          if (!jsonData || jsonData.length === 0) {
            console.log('파일에 데이터가 없음');
            setError('파일에 데이터가 없거나 올바른 형식이 아닙니다.');
            setLoading(false);
            return;
          }
          
          // 첫 번째 행 로깅하여 디버깅
          console.log('첫 번째 행 내용:', jsonData[0]);
          console.log('필드 목록:', Object.keys(jsonData[0]).join(', '));
          
          // 데이터 변환
          console.log('데이터 변환 시작');
          const mappedData = jsonData.map((row, index) => {
            try {
              // 필드 이름 예측
              const productNameKey = Object.keys(row).find(key => 
                key.toLowerCase().includes('제품') || 
                key.toLowerCase().includes('품명') || 
                key.toLowerCase().includes('product') || 
                key.toLowerCase().includes('name')
              );
              
              const modelNameKey = Object.keys(row).find(key => 
                key.toLowerCase().includes('모델') || 
                key.toLowerCase().includes('model')
              );
              
              const priceKey = Object.keys(row).find(key => 
                key.toLowerCase().includes('단가') || 
                key.toLowerCase().includes('가격') || 
                key.toLowerCase().includes('price')
              );
              
              if (!productNameKey || !modelNameKey || !priceKey) {
                console.warn(`행 ${index + 1}에서 필드를 찾을 수 없습니다:`, row);
                return null;
              }
              
              // 숫자 형식 정리
              let price = row[priceKey];
              // 문자열이면 쉼표 제거하고 숫자로 변환
              if (typeof price === 'string') {
                price = parseFloat(price.replace(/,/g, ''));
              }
              
              return {
                productName: String(row[productNameKey] || '알 수 없음'),
                modelName: String(row[modelNameKey] || '알 수 없음'),
                price: isNaN(price) ? 0 : Number(price)
              };
            } catch (rowError) {
              console.error(`행 ${index + 1} 처리 중 오류:`, rowError);
              return null;
            }
          }).filter(item => item !== null && item.price > 0);
          
          console.log('변환된 데이터:', mappedData.length);
          
          if (mappedData.length === 0) {
            setError('유효한 데이터를 찾을 수 없습니다. 파일의 열 이름을 확인해주세요.');
            setLoading(false);
            return;
          }
          
          console.log('파일 처리 완료, 데이터 설정');
          setProducts(mappedData);
          setFileUploaded(true);
          setLoading(false);
          
          // 계산 설정 탭으로 이동
          setActiveTab('settings');
          
        } catch (error) {
          console.error('파일 처리 중 오류:', error);
          setError('파일 처리 중 오류가 발생했습니다: ' + error.message);
          setLoading(false);
          clearTimeout(timeoutId);
        }
      };
      
      reader.onerror = (error) => {
        console.error('파일 읽기 오류:', error);
        setError('파일을 읽는 중 오류가 발생했습니다.');
        setLoading(false);
        clearTimeout(timeoutId);
      };
      
      console.log('파일 읽기 시작');
      reader.readAsArrayBuffer(file);
      
    } catch (err) {
      console.error('파일 처리 전체 오류:', err);
      setError('파일 처리 중 오류가 발생했습니다: ' + err.message);
      setLoading(false);
      clearTimeout(timeoutId);
    }
  };

  // 렌탈료 계산 함수
  const calculateRental = useCallback(() => {
    if (products.length === 0) {
      setError('계산할 제품 데이터가 없습니다. 파일을 먼저 업로드해주세요.');
      return;
    }
    
    try {
      const calculated = products.map(product => {
        // 1. 공급단가 계산 (일시불 단가 × 공급단가율)
        const supplyPrice = product.price * (supplyRatePercent / 100);
        
        // 2. 조정단가 계산 (십단위 반올림)
        const adjustedPrice = Math.round(supplyPrice / 10) * 10;
        
        // 3. 각 렌탈 기간별 총렌탈료 및 월렌탈료 계산
        const rentalInfos = rentalPeriods.map(period => {
          const discountRate = discountRates[period] / 100;
          // 렌탈수수료율 적용
          const feeRate = rentalFeeRates[period] / 100;
          
          // 1. 총렌탈료 = 일시불 단가 × 할인률
          const totalRentalFee = product.price * discountRate;
          
          // 2. 월 렌탈료 = 총렌탈료 ÷ 렌탈 기간
          const monthlyRentalFee = Math.round(totalRentalFee / period);
          
          // 3. 천 단위 반올림한 월 렌탈료(최종)
          const finalMonthlyRentalFee = Math.round(monthlyRentalFee / 1000) * 1000;
          
          // 4. 최종 렌탈료 = 월 렌탈료(최종) × 렌탈 기간
          const finalTotalRentalFee = finalMonthlyRentalFee * period;
          
          // 5. 렌탈사 수익 = 최종 렌탈료 × 렌탈수수료율
          const rentalCompanyProfit = finalTotalRentalFee * feeRate;
          
          // 6. 공급물대 = 최종 렌탈료 - 렌탈사 수익
          const supplyValue = finalTotalRentalFee - rentalCompanyProfit;
          
          return {
            period,
            discountRate: discountRates[period],
            feeRate: rentalFeeRates[period],
            totalRentalFee,
            monthlyRentalFee,
            finalMonthlyRentalFee,
            finalTotalRentalFee,
            rentalCompanyProfit,
            supplyValue
          };
        });
        
        // 4. 선택된 렌탈 기간에 대한 정보
        const selectedRentalInfo = rentalInfos.find(info => info.period === selectedPeriod);
        
        return {
          ...product,
          supplyPrice,
          adjustedPrice,
          rentalInfos,
          selectedPeriod,
          totalRentalFee: selectedRentalInfo ? selectedRentalInfo.totalRentalFee : 0,
          monthlyRentalFee: selectedRentalInfo ? selectedRentalInfo.monthlyRentalFee : 0,
          finalMonthlyRentalFee: selectedRentalInfo ? selectedRentalInfo.finalMonthlyRentalFee : 0,
          finalTotalRentalFee: selectedRentalInfo ? selectedRentalInfo.finalTotalRentalFee : 0,
          rentalCompanyProfit: selectedRentalInfo ? selectedRentalInfo.rentalCompanyProfit : 0,
          supplyValue: selectedRentalInfo ? selectedRentalInfo.supplyValue : 0
        };
      });
      
      console.log('계산된 제품:', calculated);
      setCalculatedProducts(calculated);
      
      // 결과 탭으로 이동은 계산하기 버튼에서만 수행
    } catch (err) {
      console.error('계산 오류:', err);
      setError('계산 중 오류가 발생했습니다: ' + err.message);
    }
  }, [products, supplyRatePercent, rentalPeriods, discountRates, rentalFeeRates, selectedPeriod]);

  // 공급단가율이나 할인률, 선택된 기간이 변경될 때마다 자동 계산
  useEffect(() => {
    console.log('useEffect 트리거 - fileUploaded:', fileUploaded, 'products.length:', products.length);
    if (fileUploaded && products.length > 0) {
      calculateRental();
    }
  }, [fileUploaded, products, supplyRatePercent, discountRates, rentalFeeRates, selectedPeriod, calculateRental]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto bg-gray-800 rounded-xl shadow-xl overflow-hidden">
        <div className="p-1 bg-gradient-to-r from-purple-500 to-indigo-600"></div>
        
        <div className="p-6">
          <h1 className="text-3xl font-bold mb-6 text-center text-white">
            렌탈료 계산기(참고용)
          </h1>
          
          {/* 탭 네비게이션 */}
          <div className="flex border-b border-gray-700 mb-6">
            <button 
              className={`px-4 py-2 font-medium ${activeTab === 'upload' 
                ? 'text-purple-400 border-b-2 border-purple-400' 
                : 'text-gray-400 hover:text-purple-300'}`}
              onClick={() => setActiveTab('upload')}
            >
              데이터 입력
            </button>
            <button 
              className={`px-4 py-2 font-medium ${activeTab === 'settings' 
                ? 'text-purple-400 border-b-2 border-purple-400' 
                : 'text-gray-400 hover:text-purple-300'}`}
              onClick={() => fileUploaded ? setActiveTab('settings') : null}
              disabled={!fileUploaded}
            >
              계산 설정
            </button>
            <button 
              className={`px-4 py-2 font-medium ${activeTab === 'results' 
                ? 'text-purple-400 border-b-2 border-purple-400' 
                : 'text-gray-400 hover:text-purple-300'}`}
              onClick={() => calculatedProducts.length > 0 ? setActiveTab('results') : null}
              disabled={calculatedProducts.length === 0}
            >
              계산 결과
            </button>
          </div>
          
          {error && (
            <div className="mt-4 p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-300 mb-6">
              <span>{error}</span>
            </div>
          )}
          
          {loading && (
            <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
              <div className="bg-gray-800 p-6 rounded-lg shadow-xl flex flex-col items-center">
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-purple-500 mb-4"></div>
                <p className="text-gray-300">파일 처리 중...</p>
              </div>
            </div>
          )}
          
          {/* 데이터 입력 섹션 */}
          {activeTab === 'upload' && (
            <div className="mb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* 단일 상품 입력 */}
                <div className="border border-gray-700 rounded-xl p-6 bg-gray-800/50">
                  <h3 className="text-lg font-medium mb-4 text-purple-300">단일 상품 입력</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">제품명</label>
                      <input
                        type="text"
                        name="productName"
                        value={singleProduct.productName}
                        onChange={handleSingleProductChange}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all duration-200"
                        placeholder="예: 냉장고"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">모델명</label>
                      <input
                        type="text"
                        name="modelName"
                        value={singleProduct.modelName}
                        onChange={handleSingleProductChange}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all duration-200"
                        placeholder="예: ABC-123"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">일시불 단가</label>
                      <input
                        type="text"
                        name="price"
                        value={singleProduct.price}
                        onChange={handleSingleProductChange}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all duration-200"
                        placeholder="예: 1000000"
                      />
                    </div>
                    <div className="mt-4">
                      <button
                        className={buttonStyles.primary}
                        onClick={handleAddSingleProduct}
                      >
                        상품 추가
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* 파일 업로드 */}
                <div className="border border-gray-700 rounded-xl p-6 bg-gray-800/50">
                  <h3 className="text-lg font-medium mb-4 text-purple-300">엑셀/CSV 파일 업로드</h3>
                  <div 
                    className={`flex flex-col items-center justify-center p-8 border-2 ${isDragging ? 'border-purple-500 bg-purple-900/20' : 'border-dashed border-gray-600 bg-gray-800'} rounded-xl cursor-pointer transition-all duration-300 hover:border-purple-400 hover:bg-gray-700/50`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => {
                      const fileInput = document.getElementById('file-upload');
                      if (fileInput) {
                        fileInput.click();
                      }
                    }}
                  >
                    <h3 className="text-xl font-medium mb-2 text-gray-300">파일을 드래그하거나 클릭하여 업로드</h3>
                    <p className="text-sm text-gray-400 text-center mb-4">
                      제품명, 모델명, 일시불 단가가 포함된 엑셀 또는 CSV 파일을 업로드하세요
                    </p>
                    
                    <input 
                      id="file-upload"
                      type="file" 
                      className="hidden" 
                      accept=".xlsx,.xls,.csv" 
                      onChange={handleFileUpload} 
                    />
                  </div>
                  
                  <div className="mt-4 flex justify-center space-x-4">
                    <button
                      className={buttonStyles.special}
                      onClick={downloadSampleTemplate}
                    >
                      <svg className="w-4 h-4 mr-2 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                      </svg>
                      샘플 양식 다운로드
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* 계산 설정 섹션 */}
          {activeTab === 'settings' && fileUploaded && (
            <div className="mb-8">
              <div className="mb-6 bg-purple-900/20 p-4 rounded-xl border border-purple-800/50">
                <h3 className="font-medium text-purple-300 mb-2">
                  업로드 된 제품 데이터
                </h3>
                <p className="text-sm text-purple-200">
                  총 {products.length}개 제품이 로드되었습니다.
                </p>
              </div>
            
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* 공급단가율 설정 */}
                <div className="bg-gray-800 p-6 rounded-xl shadow-md border border-gray-700">
                  <h3 className="text-lg font-medium mb-4 text-purple-300">
                    공급단가율 설정
                  </h3>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      step="0.1"
                      value={supplyRatePercent}
                      onChange={handleSupplyRateChange}
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <span className="text-gray-400">%</span>
                    </div>
                  </div>
                </div>
                
                {/* 렌탈 기간 선택 */}
                <div className="bg-gray-800 p-6 rounded-xl shadow-md border border-gray-700">
                  <h3 className="text-lg font-medium mb-4 text-purple-300">
                    렌탈 기간 선택
                  </h3>
                  <div className="grid grid-cols-4 gap-3">
                    {rentalPeriods.map(period => (
                      <button
                        key={period}
                        onClick={() => setSelectedPeriod(period)}
                        className={`py-3 rounded-lg font-medium ${
                          selectedPeriod === period 
                            ? 'bg-purple-600 text-white shadow-md' 
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        {period}개월
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* 할인률 설정 */}
              <div className="bg-gray-800 p-6 rounded-xl shadow-md border border-gray-700 mb-8">
                <h3 className="text-lg font-medium mb-4 text-purple-300">
                  할인률 설정
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {rentalPeriods.map(period => (
                    <div key={period} className="bg-gray-700 p-4 rounded-lg border border-gray-600">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium text-gray-300">{period}개월</span>
                        <span className={`px-2 py-1 rounded-full text-xs ${selectedPeriod === period ? 'bg-purple-900 text-purple-200' : 'bg-gray-600 text-gray-300'}`}>
                          {selectedPeriod === period ? '선택됨' : ''}
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          step="0.1"
                          value={discountRates[period]}
                          onChange={(e) => handleDiscountRateChange(period, e)}
                          className={`w-full px-3 py-2 bg-gray-800 border rounded-lg text-white ${selectedPeriod === period ? 'border-purple-500' : 'border-gray-600'}`}
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                          <span className="text-gray-400">%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* 렌탈수수료율 설정 */}
              <div className="bg-gray-800 p-6 rounded-xl shadow-md border border-gray-700 mb-8">
                <h3 className="text-lg font-medium mb-4 text-purple-300">
                  렌탈수수료율 설정
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {rentalPeriods.map(period => (
                    <div key={period} className="bg-gray-700 p-4 rounded-lg border border-gray-600">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium text-gray-300">{period}개월</span>
                        <span className={`px-2 py-1 rounded-full text-xs ${selectedPeriod === period ? 'bg-purple-900 text-purple-200' : 'bg-gray-600 text-gray-300'}`}>
                          {selectedPeriod === period ? '선택됨' : ''}
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={rentalFeeRates[period]}
                          onChange={(e) => handleRentalFeeRateChange(period, e)}
                          className={`w-full px-3 py-2 bg-gray-800 border rounded-lg text-white ${selectedPeriod === period ? 'border-purple-500' : 'border-gray-600'}`}
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                          <span className="text-gray-400">%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-between">
                <button 
                  className={buttonStyles.secondary}
                  onClick={() => setActiveTab('upload')}
                >
                  데이터 입력으로 돌아가기
                </button>
                
                <button 
                  className={buttonStyles.primary}
                  onClick={(e) => {
                    e.preventDefault();
                    console.log('계산하기 버튼 클릭');
                    calculateRental();
                    setActiveTab('results');
                  }}
                >
                  계산하기
                </button>
              </div>
            </div>
          )}
          
          {/* 계산 결과 섹션 */}
          {activeTab === 'results' && calculatedProducts.length > 0 && (
            <div>
              <div className="mb-6 flex justify-between items-center">
                <h3 className="text-lg md:text-xl font-bold text-purple-300 whitespace-nowrap">
                  렌탈 결과({selectedPeriod}개월)
                </h3>
                
                <div className="flex items-center">
                  <span className="text-xs md:text-sm bg-purple-900/30 text-purple-300 px-2 py-1 rounded-full">
                    할인율:{discountRates[selectedPeriod]}%
                  </span>
                  <span className="ml-2 text-xs md:text-sm bg-indigo-900/30 text-indigo-300 px-2 py-1 rounded-full">
                    {calculatedProducts.length}개
                  </span>
                </div>
              </div>
              
              <div className="bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-700 mb-6">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-gray-900">
                      <tr>
                        <th className="px-2 py-2 md:px-6 md:py-3 text-left text-xs font-medium text-gray-400 uppercase">제품명</th>
                        <th className="px-2 py-2 md:px-6 md:py-3 text-left text-xs font-medium text-gray-400 uppercase">모델명</th>
                        <th className="px-2 py-2 md:px-6 md:py-3 text-right text-xs font-medium text-gray-400 uppercase">일시불 단가</th>
                        <th className="px-2 py-2 md:px-6 md:py-3 text-right text-xs font-medium text-gray-400 uppercase">총 렌탈료</th>
                        <th className="px-2 py-2 md:px-6 md:py-3 text-right text-xs font-medium text-gray-400 uppercase">월 렌탈료</th>
                        <th className="px-2 py-2 md:px-6 md:py-3 text-right text-xs font-medium text-gray-400 uppercase">월 렌탈료(최종)</th>
                        <th className="px-2 py-2 md:px-6 md:py-3 text-right text-xs font-medium text-gray-400 uppercase">최종 렌탈료</th>
                        <th className="px-2 py-2 md:px-6 md:py-3 text-right text-xs font-medium text-gray-400 uppercase">렌탈사 수익</th>
                        <th className="px-2 py-2 md:px-6 md:py-3 text-right text-xs font-medium text-gray-400 uppercase">공급물대</th>
                      </tr>
                    </thead>
                    <tbody className="bg-gray-800 divide-y divide-gray-700">
                      {calculatedProducts.map((product, index) => (
                        <tr key={index} className={index % 2 === 0 ? 'bg-gray-800' : 'bg-gray-750'}>
                          <td className="px-2 py-2 md:px-6 md:py-4 whitespace-nowrap text-xs md:text-sm font-medium text-gray-100">{product.productName}</td>
                          <td className="px-2 py-2 md:px-6 md:py-4 whitespace-nowrap text-xs md:text-sm text-gray-300">{product.modelName}</td>
                          <td className="px-2 py-2 md:px-6 md:py-4 whitespace-nowrap text-xs md:text-sm text-gray-300 text-right">{product.price.toLocaleString()}원</td>
                          <td className="px-2 py-2 md:px-6 md:py-4 whitespace-nowrap text-xs md:text-sm text-gray-300 text-right">{Math.round(product.totalRentalFee).toLocaleString()}원</td>
                          <td className="px-2 py-2 md:px-6 md:py-4 whitespace-nowrap text-xs md:text-sm text-gray-300 text-right">{product.monthlyRentalFee.toLocaleString()}원</td>
                          <td className="px-2 py-2 md:px-6 md:py-4 whitespace-nowrap text-xs md:text-sm font-medium text-purple-300 text-right">{product.finalMonthlyRentalFee.toLocaleString()}원</td>
                          <td className="px-2 py-2 md:px-6 md:py-4 whitespace-nowrap text-xs md:text-sm font-medium text-indigo-300 text-right">{product.finalTotalRentalFee.toLocaleString()}원</td>
                          <td className="px-2 py-2 md:px-6 md:py-4 whitespace-nowrap text-xs md:text-sm font-medium text-pink-300 text-right">{Math.round(product.rentalCompanyProfit).toLocaleString()}원</td>
                          <td className="px-2 py-2 md:px-6 md:py-4 whitespace-nowrap text-xs md:text-sm font-medium text-amber-300 text-right">{Math.round(product.supplyValue).toLocaleString()}원</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
              <div className="flex justify-between">
                <button 
                  className={`${buttonStyles.secondary} flex items-center`}
                  onClick={() => setActiveTab('settings')}
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                  </svg>
                  뒤로가기
                </button>
                
                <div className="flex space-x-3">
                  <button 
                    className={`${buttonStyles.danger} flex items-center`}
                    onClick={resetCalculation}
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                    </svg>
                    리셋
                  </button>
                  
                  <button 
                    className={`${buttonStyles.export} flex items-center`}
                    onClick={() => {
                      // 엑셀 파일로 내보내기
                      const worksheet = XLSX.utils.json_to_sheet(calculatedProducts.map(p => ({
                        '제품명': p.productName,
                        '모델명': p.modelName,
                        '월 렌탈료(최종)': p.finalMonthlyRentalFee,
                        '렌탈 기간': `${p.selectedPeriod}개월`,
                        '최종 렌탈료': p.finalTotalRentalFee,
                        '공급물대': Math.round(p.supplyValue)
                      })));
                      
                      const workbook = XLSX.utils.book_new();
                      XLSX.utils.book_append_sheet(workbook, worksheet, '렌탈 계산 결과');
                      
                      XLSX.writeFile(workbook, `렌탈계산결과_${selectedPeriod}개월_${new Date().toISOString().split('T')[0]}.xlsx`);
                    }}
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                    </svg>
                    엑셀다운
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="text-center mt-6 text-gray-500 text-sm">
        © 2025 렌탈료 계산기 | 모든 계산 결과는 참고용입니다
      </div>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <RentalCalculator />
  </React.StrictMode>
); 