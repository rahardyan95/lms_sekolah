import React from 'react';
import { NewsPost, SchoolConfig } from '../../../types';
import { PublicLandingPage } from '../../landing/PublicLandingPage';

interface CmsPublicModuleProps {
  news: NewsPost[];
  schoolConfig: SchoolConfig;
  onGoToLogin: () => void;
  onGoToSpmb: () => void;
  onShowToast: (title: string, message?: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
}

export const CmsPublicModule: React.FC<CmsPublicModuleProps> = (props) => <PublicLandingPage {...props} />;
