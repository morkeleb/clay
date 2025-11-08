/**
 * Type definitions for template engine and Handlebars context
 */

import type { ClayModel } from './model';

/**
 * Context variables automatically added to template data
 */
export interface ClayTemplateContext {
  clay_model: ClayModel;
  clay_parent?: any;
  clay_key?: string;
  clay_json_key?: string;
  json_path?: string;
  [key: string]: any;
}

/**
 * Template engine configuration
 */
export interface TemplateEngineConfig {
  partials?: string[];
  helpers?: {
    [name: string]: Function;
  };
}

/**
 * Handlebars helper function signature
 */
export type HandlebarsHelper = (...args: any[]) => any;

/**
 * Formatter function signature
 */
export type FormatterFunction = (
  content: string,
  filePath: string
) => string | Promise<string>;

/**
 * Registered formatter interface
 */
export interface RegisteredFormatter {
  name: string;
  format: FormatterFunction;
}
