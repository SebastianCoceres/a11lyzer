import React, { useState } from 'react';
import { useMutation, useQueryClient } from 'react-query';
import { db } from '../db';
import axe from 'axe-core';
import DOMPurify from 'dompurify';

const removeUrlParams = (url: string): string => {
  try {
    const parsedUrl = new URL(url);
    parsedUrl.search = '';
    return parsedUrl.toString();
  } catch (error) {
    console.error('Error parsing URL:', error);
    return url;
  }
};

export const analyzeUrl = async (url: string) => {
  const cleanUrl = removeUrlParams(url);
  const response = await fetch(cleanUrl);
  const html = await response.text();
  const sanitizedHtml = DOMPurify.sanitize(html);

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = sanitizedHtml;
  document.body.appendChild(tempDiv);

  try {
    const results = await axe.run(tempDiv);
    return {
      url: cleanUrl,
      violations: results.violations,
      timestamp: new Date(),
    };
  } finally {
    document.body.removeChild(tempDiv);
  }
};

const crawlAndAnalyze = async (baseUrl: string, maxDepth = 2) => {
  const visited = new Set<string>();
  const queue: [string, number][] = [[removeUrlParams(baseUrl), 0]];
  const results: Awaited<ReturnType<typeof analyzeUrl>>[] = [];
  const analyzedUrls = new Set<string>();

  const portalMatch = baseUrl.match(/\/portal\/([^/]+)/);
  if (!portalMatch) {
    console.error('Invalid base URL: portal not found');
    return results;
  }
  const portalName = portalMatch[1];

  while (queue.length > 0) {
    const [url, depth] = queue.shift()!;
    if (visited.has(url) || depth > maxDepth) {
      continue;
    }

    visited.add(url);
    console.log(`Analyzing ${url}`);

    try {
      if (!analyzedUrls.has(url)) {
        const result = await analyzeUrl(url);
        results.push(result);
        analyzedUrls.add(url);
      }

      const response = await fetch(url);
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const links = Array.from(doc.querySelectorAll('a[href]'))
        .map((a) => {
          try {
            return removeUrlParams(new URL(a.getAttribute('href')!, url).href);
          } catch (error) {
            return null;
          }
        })
        .filter(
          (href): href is string =>
            href !== null &&
            href.includes(`/portal/${portalName}/`) &&
            !href.includes('/servicio/') &&
            href.startsWith(removeUrlParams(baseUrl)) &&
            !href.includes('#') &&
            !analyzedUrls.has(href) // Only add URLs that haven't been analyzed yet
        );

      for (const link of links) {
        queue.push([link, depth + 1]);
      }
    } catch (error) {
      console.error(`Error analyzing ${url}:`, error);
    }
  }

  return results;
};

const UrlAnalyzer: React.FC = () => {
  const [url, setUrl] = useState('');
  const [isCrawling, setIsCrawling] = useState(false);
  const queryClient = useQueryClient();

  const analyzeMutation = useMutation(
    (crawl: boolean) => (crawl ? crawlAndAnalyze(url) : analyzeUrl(url)),
    {
      onSuccess: async (data) => {
        const dataArray = Array.isArray(data) ? data : [data];
        const existingUrls = new Set(
          (await db.urlResults.toArray()).map((result) => result.url)
        );

        const newResults = dataArray.filter(
          (result) => !existingUrls.has(result.url)
        );

        if (newResults.length > 0) {
          await db.urlResults.bulkAdd(newResults);
          queryClient.invalidateQueries('urlResults');
        }

        setUrl('');
        setIsCrawling(false);
      },
      onError: (error) => {
        console.error('Error analyzing URL:', error);
        setIsCrawling(false);
      },
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url) {
      setIsCrawling(true);
      analyzeMutation.mutate(true);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mb-8">
      <div className="flex">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter URL to analyze (e.g., https://www.zaragoza.es/sede/portal/etopia)"
          className="flex-grow p-2 border rounded-l"
          required
        />
        <button
          type="submit"
          className="bg-red-600 text-white px-4 py-2 rounded-r"
          disabled={analyzeMutation.isLoading || isCrawling}
        >
          {analyzeMutation.isLoading || isCrawling
            ? 'Analyzing...'
            : 'Analyze & Crawl'}
        </button>
      </div>
      {analyzeMutation.isError && (
        <p className="text-red-500 mt-2">
          Error analyzing URL. Please try again.
        </p>
      )}
    </form>
  );
};

export default UrlAnalyzer;
