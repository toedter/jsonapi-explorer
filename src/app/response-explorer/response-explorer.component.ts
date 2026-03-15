import { Component, Input, OnInit, ViewEncapsulation, inject } from '@angular/core';
import { Command, RequestService, Response } from '../request/request.service';
import { JsonHighlighterService } from '../json-highlighter/json-highlighter.service';
import { HttpErrorResponse } from '@angular/common/http';

class RelationshipEntry {
  constructor(
    public name: string,
    public selfLink: string,
    public relatedLink: string,
    public dataType: 'single' | 'array' | 'null',
    public resourceCount: number
  ) {}
}

class TopLevelLink {
  constructor(
    public rel: string,
    public href: string
  ) {}
}

class IncludedResource {
  constructor(
    public type: string,
    public id: string,
    public attributes: any,
    public resource: any
  ) {}
}

class JsonApiError {
  constructor(
    public status: string,
    public title: string,
    public detail: string,
    public source: any,
    public code: string
  ) {}
}

@Component({
  selector: 'app-response-explorer',
  templateUrl: './response-explorer.component.html',
  styleUrls: ['./response-explorer.component.css'],
  encapsulation: ViewEncapsulation.None,
  imports: [],
})
export class ResponseExplorerComponent implements OnInit {
  @Input() jsonRoot: any;
  @Input() prefix: string;
  @Input() includedPool: any[];

  // Display state
  resourceType: string;
  resourceId: string;
  showIdentity: boolean;

  attributes: string;
  showAttributes: boolean;

  relationships: RelationshipEntry[];
  showRelationships: boolean;

  topLevelLinks: TopLevelLink[];
  showLinks: boolean;

  dataArray: any[];
  showDataArray: boolean;

  includedResources: IncludedResource[];
  showIncluded: boolean;

  meta: string;
  showMeta: boolean;

  jsonapiVersion: string;
  showJsonapiVersion: boolean;

  errors: JsonApiError[];
  showErrors: boolean;

  isLoading = false;
  command = Command;
  responseUrl: string;
  httpErrorResponse: HttpErrorResponse;

  private readonly requestService = inject(RequestService);
  private readonly jsonHighlighterService = inject(JsonHighlighterService);

  ngOnInit(): void {
    this.requestService.getLoadingObservable().subscribe(loading => {
      this.isLoading = loading;
    });

    if (this.jsonRoot) {
      this.processJsonObject(this.jsonRoot);
    } else {
      this.subscribeToResponses();
    }
  }

  private subscribeToResponses(): void {
    this.requestService.getResponseObservable().subscribe({
      next: (response: Response) => {
        this.httpErrorResponse = response.httpErrorResponse;

        if (response.httpResponse) {
          this.handleSuccessResponse(response.httpResponse);
        } else if (this.httpErrorResponse) {
          this.handleErrorResponse(this.httpErrorResponse);
        }
      },
      error: error => console.error('Error during HTTP request: ' + JSON.stringify(error)),
    });
  }

  private handleSuccessResponse(httpResponse: any): void {
    this.responseUrl = httpResponse.url;
    const body = typeof httpResponse.body === 'string' ? {} : httpResponse.body || {};
    this.processJsonObject(body);
  }

  private handleErrorResponse(errorResponse: HttpErrorResponse): void {
    this.responseUrl = errorResponse.url;
    const error = typeof errorResponse.error === 'string' ? {} : errorResponse.error || {};
    this.processJsonObject(error);
  }

  private processJsonObject(json: any): void {
    this.prefix = this.prefix || '';
    this.resetState();

    // Detect JSON:API document
    const hasData = json.hasOwnProperty('data');
    const hasErrors = json.hasOwnProperty('errors');
    const hasMeta = json.hasOwnProperty('meta');
    const hasLinks = json.hasOwnProperty('links');
    const hasIncluded = json.hasOwnProperty('included');
    const hasJsonapi = json.hasOwnProperty('jsonapi');

    // If it's not a JSON:API document at all, display as plain properties
    if (!hasData && !hasErrors && !hasMeta && !hasLinks && !hasJsonapi) {
      this.processPlainProperties(json);
      return;
    }

    // Process primary data
    if (hasData) {
      if (Array.isArray(json.data)) {
        this.processDataArray(json.data);
      } else if (json.data !== null) {
        this.processResourceIdentity(json.data);
        this.processAttributes(json.data.attributes);
        this.processRelationships(json.data.relationships);
      }
    }

    // Process top-level links
    if (hasLinks) {
      this.processTopLevelLinks(json.links);
    }

    // Process included resources
    if (hasIncluded) {
      this.processIncludedResources(json.included);
    }

    // Process meta
    if (hasMeta) {
      this.processMeta(json.meta);
    }

    // Process jsonapi version
    if (hasJsonapi && json.jsonapi.version) {
      this.jsonapiVersion = json.jsonapi.version;
      this.showJsonapiVersion = true;
    }

    // Process errors
    if (hasErrors) {
      this.processErrors(json.errors);
    }
  }

  private resetState(): void {
    this.showIdentity = false;
    this.showAttributes = false;
    this.showRelationships = false;
    this.showLinks = false;
    this.showDataArray = false;
    this.showIncluded = false;
    this.showMeta = false;
    this.showJsonapiVersion = false;
    this.showErrors = false;
    this.resourceType = null;
    this.resourceId = null;
    this.attributes = null;
    this.relationships = [];
    this.topLevelLinks = [];
    this.dataArray = [];
    this.includedResources = [];
    this.errors = [];
    this.meta = null;
    this.jsonapiVersion = null;
  }

  private processPlainProperties(json: any): void {
    if (Object.keys(json).length > 0) {
      this.showAttributes = true;
      this.attributes = this.jsonHighlighterService.syntaxHighlight(JSON.stringify(json, undefined, 2));
    }
  }

  private processResourceIdentity(data: any): void {
    if (data.type || data.id) {
      this.showIdentity = true;
      this.resourceType = data.type;
      this.resourceId = data.id;
    }
  }

  private processAttributes(attrs: any): void {
    if (attrs && Object.keys(attrs).length > 0) {
      this.showAttributes = true;
      this.attributes = this.jsonHighlighterService.syntaxHighlight(JSON.stringify(attrs, undefined, 2));
    }
  }

  private processRelationships(rels: any): void {
    if (!rels) return;

    this.showRelationships = true;
    this.relationships = [];

    Object.keys(rels).forEach(name => {
      const rel = rels[name];
      let selfLink = '';
      let relatedLink = '';
      let dataType: 'single' | 'array' | 'null' = 'null';
      let resourceCount = 0;

      if (rel.links) {
        if (rel.links.self) {
          selfLink = typeof rel.links.self === 'string' ? rel.links.self : rel.links.self.href;
        }
        if (rel.links.related) {
          relatedLink = typeof rel.links.related === 'string' ? rel.links.related : rel.links.related.href;
        }
      }

      if (rel.hasOwnProperty('data')) {
        if (Array.isArray(rel.data)) {
          dataType = 'array';
          resourceCount = rel.data.length;
        } else if (rel.data !== null) {
          dataType = 'single';
          resourceCount = 1;
        }
      }

      this.relationships.push(new RelationshipEntry(name, selfLink, relatedLink, dataType, resourceCount));
    });
  }

  private processTopLevelLinks(links: any): void {
    if (!links) return;

    this.showLinks = true;
    this.topLevelLinks = [];

    Object.keys(links).forEach(rel => {
      const link = links[rel];
      const href = typeof link === 'string' ? link : link?.href;
      if (href) {
        this.topLevelLinks.push(new TopLevelLink(rel, href));
      }
    });
  }

  private processDataArray(data: any[]): void {
    if (data.length > 0) {
      this.showDataArray = true;
      this.dataArray = data;
    }
  }

  private processIncludedResources(included: any[]): void {
    if (!included || included.length === 0) return;

    this.showIncluded = true;
    this.includedResources = [];

    included.forEach(resource => {
      this.includedResources.push(
        new IncludedResource(resource.type, resource.id, resource.attributes, resource)
      );
    });
  }

  private processMeta(meta: any): void {
    if (meta && Object.keys(meta).length > 0) {
      this.showMeta = true;
      this.meta = this.jsonHighlighterService.syntaxHighlight(JSON.stringify(meta, undefined, 2));
    }
  }

  private processErrors(errors: any[]): void {
    if (!errors || errors.length === 0) return;

    this.showErrors = true;
    this.errors = [];

    errors.forEach(err => {
      this.errors.push(
        new JsonApiError(err.status, err.title, err.detail, err.source, err.code)
      );
    });
  }

  resolveUrl(href: string): string {
    if (!href) return href;
    try {
      if (this.responseUrl) {
        return decodeURI(new URL(href, this.responseUrl).href);
      }
      return href;
    } catch {
      return href;
    }
  }

  processCommand(command: Command, url: string): void {
    this.requestService.processCommand(command, url);
  }

  wrapAsDocument(resource: any): any {
    return { data: resource };
  }

  getRequestButtonClass(command: Command): string {
    const base = 'ms-1 btn btn-sm nav-button ';
    const variants = {
      [Command.Get]: 'btn-outline-success',
      [Command.Post]: 'btn-outline-info',
      [Command.Put]: 'btn-outline-warning',
      [Command.Patch]: 'btn-outline-warning',
      [Command.Delete]: 'btn-outline-danger',
    };
    return base + (variants[command] || 'btn-outline-primary');
  }

  getIncludedPool(): any[] {
    return this.includedPool || (this.includedResources?.length > 0 ? this.dataArray : null) ? [] : [];
  }
}
