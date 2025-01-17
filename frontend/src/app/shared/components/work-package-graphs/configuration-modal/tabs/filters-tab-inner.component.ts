import { Component } from '@angular/core';
import { I18nService } from 'core-app/core/i18n/i18n.service';
import { TabComponent } from 'core-app/features/work-packages/components/wp-table/configuration-modal/tab-portal-outlet';
import { WorkPackageViewFiltersService } from 'core-app/features/work-packages/routing/wp-view-base/view-services/wp-view-filters.service';
import { QueryFilterInstanceResource } from 'core-app/features/hal/resources/query-filter-instance-resource';
import { WpGraphConfigurationService } from 'core-app/shared/components/work-package-graphs/configuration/wp-graph-configuration.service';
import { WorkPackageStatesInitializationService } from 'core-app/features/work-packages/components/wp-list/wp-states-initialization.service';
import { QuerySpacedTabComponent } from 'core-app/shared/components/work-package-graphs/configuration-modal/tabs/abstract-query-spaced-tab.component';
import { WorkPackageFiltersService } from 'core-app/features/work-packages/components/filters/wp-filters/wp-filters.service';

@Component({
  selector: 'filters-tab-inner',
  templateUrl: './filters-tab-inner.component.html',
})
export class WpGraphConfigurationFiltersTabInnerComponent extends QuerySpacedTabComponent implements TabComponent {
  public filters:QueryFilterInstanceResource[] = [];

  public text = {
    multiSelectLabel: this.I18n.t('js.work_packages.label_column_multiselect'),
  };

  constructor(readonly I18n:I18nService,
    readonly wpTableFilters:WorkPackageViewFiltersService,
    readonly wpFiltersService:WorkPackageFiltersService,
    readonly wpStatesInitialization:WorkPackageStatesInitializationService,
    readonly wpGraphConfiguration:WpGraphConfigurationService) {
    super(I18n, wpStatesInitialization, wpGraphConfiguration);
  }

  ngOnInit() {
    this.initializeQuerySpace()
      .then(() => {
        this.wpTableFilters
          .onReady()
          .then(() => {
            this.filters = this.wpTableFilters.current;
          });
      });
  }

  public onSave() {
    if (this.filters) {
      this.wpTableFilters.replaceIfComplete(this.filters);
      this.wpTableFilters.applyToQuery(this.wpGraphConfiguration.queries[0]);
    }
  }

  protected get query() {
    return this.wpGraphConfiguration.queries[0];
  }
}
